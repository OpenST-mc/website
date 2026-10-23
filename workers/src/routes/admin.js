// 管理员端点：info.json、预览图、资源替换与整目录删除。
import { decodeBase64Utf8, encodeBase64Bytes, encodeBase64Utf8 } from '../lib/encoding.js';
import { cleanupItemFiles, invalidateItemIndex, resolveItemPrefix } from '../lib/github.js';
import { checkCSRF, getAuthToken, getCORSHeaders, isRateLimited } from '../lib/http.js';
import {
  ARCHIVE_FILE_EXTENSIONS,
  MAX_ARCHIVE_BYTES,
  MAX_IMAGE_BYTES,
  isArchiveFileName,
  isFileEntry,
  isSafeFolder,
  normalizeInfoPatch,
  previewSourceName,
} from '../lib/validation.js';

// 代理签名已校验时跳过 CSRF/限流；否则按浏览器直连处理。
function requireAdmin(request, proxyToken) {
  if (!proxyToken) {
    const csrf = checkCSRF(request);
    if (csrf) return { response: csrf };
    if (isRateLimited(request, 'admin')) {
      return { response: new Response('Too Many Requests', { status: 429, headers: getCORSHeaders(request) }) };
    }
  }

  const token = proxyToken || getAuthToken(request);
  if (!token) {
    return { response: new Response('Missing Token', { status: 401, headers: getCORSHeaders(request) }) };
  }
  return { token };
}

export async function handleUpdateInfo({ request, config, proxyToken }) {
  const auth = requireAdmin(request, proxyToken);
  if (auth.response) return auth.response;
  const token = auth.token;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: getCORSHeaders(request) });
  }

  const { folder, newInfo } = payload || {};
  if (!isSafeFolder(folder)) {
    return new Response('Invalid folder', { status: 400, headers: getCORSHeaders(request) });
  }
  const patch = normalizeInfoPatch(newInfo);
  if (!patch) {
    return new Response('Invalid info fields', { status: 400, headers: getCORSHeaders(request) });
  }

  // 经定位表解析稿件在稿件库中的真实路径
  const prefix = await resolveItemPrefix(token, config.archiveRepo, folder);
  if (!prefix) {
    return new Response('Archive not found', { status: 404, headers: getCORSHeaders(request) });
  }

  const infoUrl = `https://api.github.com/repos/${config.archiveRepo}/contents/${encodeURIComponent(prefix)}/info.json`;
  const fileRes = await fetch(infoUrl, {
    headers: { Authorization: `token ${token}`, 'User-Agent': 'OpenST-Portal' },
  });

  if (fileRes.status === 404) {
    return new Response('info.json not found', { status: 404, headers: getCORSHeaders(request) });
  }
  if (!fileRes.ok) {
    return new Response('Find info.json failed', { status: 502, headers: getCORSHeaders(request) });
  }

  const fileData = await fileRes.json();
  let existing;
  try {
    existing = JSON.parse(decodeBase64Utf8(fileData.content));
  } catch {
    return new Response('Existing info.json is invalid', { status: 502, headers: getCORSHeaders(request) });
  }
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
    return new Response('Existing info.json is not an object', { status: 502, headers: getCORSHeaders(request) });
  }

  // 顺手清掉旧版 info.json 中的派生字段（稳定 id 在 .meta.json，路径/文件名由 CI 计算）
  const updated = { ...existing };
  delete updated.id;
  delete updated.folder;
  delete updated.preview;
  delete updated.filename;
  Object.assign(updated, patch);

  const putRes = await fetch(infoUrl, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'OpenST-Portal',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Staff Edit: ${patch.name}`,
      content: encodeBase64Utf8(JSON.stringify(updated, null, 4)),
      sha: fileData.sha,
      branch: 'main',
    }),
  });

  if (!putRes.ok) {
    return new Response(JSON.stringify({ success: false, error: 'GitHub write failed' }), {
      status: 502,
      headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
    });
  }

  await invalidateItemIndex();
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
  });
}

export async function handleUpdatePreview({ request, config, proxyToken }) {
  const auth = requireAdmin(request, proxyToken);
  if (auth.response) return auth.response;
  const token = auth.token;

  const fd = await request.formData();
  const file = fd.get('file');
  const folder = fd.get('folder');

  if (!isSafeFolder(folder)) {
    return new Response('Invalid folder', { status: 400, headers: getCORSHeaders(request) });
  }
  if (!isFileEntry(file)) {
    return new Response('Missing file', { status: 400, headers: getCORSHeaders(request) });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return new Response('Image too large', { status: 413, headers: getCORSHeaders(request) });
  }
  const forcedName = previewSourceName(file.name);
  if (!forcedName) {
    return new Response('Unsupported image', { status: 400, headers: getCORSHeaders(request) });
  }

  // 经定位表解析稿件在稿件库中的真实路径
  const prefix = await resolveItemPrefix(token, config.archiveRepo, folder);
  if (!prefix) {
    return new Response('Archive not found', { status: 404, headers: getCORSHeaders(request) });
  }

  const safeFolder = encodeURIComponent(prefix);
  const imgUrl = `https://api.github.com/repos/${config.archiveRepo}/contents/${safeFolder}/${forcedName}`;

  // 同名文件覆盖时必须带上现有 blob sha
  const getRes = await fetch(imgUrl, {
    headers: { Authorization: `token ${token}`, 'User-Agent': 'OpenST-Portal' },
  });
  let sha = null;
  if (getRes.status === 404) {
    sha = null;
  } else if (getRes.ok) {
    const getData = await getRes.json();
    sha = getData.sha;
  } else {
    return new Response('Read preview failed', { status: 502, headers: getCORSHeaders(request) });
  }

  const base64Image = encodeBase64Bytes(await file.arrayBuffer());
  const putRes = await fetch(imgUrl, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'OpenST-Portal',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Update Preview: ${folder}`,
      content: base64Image,
      ...(sha ? { sha } : {}),
      branch: 'main',
    }),
  });

  if (!putRes.ok) {
    return new Response(JSON.stringify({ success: false, error: 'GitHub write failed' }), {
      status: 502,
      headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
    });
  }

  // 清理旧源图与派生图：只保留刚上传的 preview.*，其余由 CI 重建
  const cleanup = await cleanupItemFiles(token, config.archiveRepo, prefix, (name) => {
    if (name === forcedName) return false;
    const lower = name.toLowerCase();
    return lower === 'thumb.webp' || lower.startsWith('preview.');
  });
  await invalidateItemIndex();

  return new Response(JSON.stringify({ success: true, newName: forcedName, cleanup }), {
    headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
  });
}

export async function handleReplaceLitematic({ request, config, proxyToken }) {
  const auth = requireAdmin(request, proxyToken);
  if (auth.response) return auth.response;
  const token = auth.token;

  const fd = await request.formData();
  const newFile = fd.get('file');
  const folder = fd.get('folder');

  if (!isSafeFolder(folder)) {
    return new Response('Invalid folder', { status: 400, headers: getCORSHeaders(request) });
  }
  if (!isFileEntry(newFile)) {
    return new Response('Missing file', { status: 400, headers: getCORSHeaders(request) });
  }
  if (newFile.size > MAX_ARCHIVE_BYTES) {
    return new Response('Archive too large', { status: 413, headers: getCORSHeaders(request) });
  }
  const newFileName = newFile.name;
  if (!isArchiveFileName(newFileName)) {
    return new Response('Unsupported archive', { status: 400, headers: getCORSHeaders(request) });
  }

  // 经定位表解析稿件在稿件库中的真实路径
  const prefix = await resolveItemPrefix(token, config.archiveRepo, folder);
  if (!prefix) {
    return new Response('Archive not found', { status: 404, headers: getCORSHeaders(request) });
  }

  const safeFolder = encodeURIComponent(prefix);
  const filePath = `${safeFolder}/${encodeURIComponent(newFileName)}`;
  const fileUrl = `https://api.github.com/repos/${config.archiveRepo}/contents/${filePath}`;

  // 同名文件覆盖时必须带上现有 blob sha
  const getRes = await fetch(fileUrl, {
    headers: { Authorization: `token ${token}`, 'User-Agent': 'OpenST-Portal' },
  });
  let sha = null;
  if (getRes.status === 404) {
    sha = null;
  } else if (getRes.ok) {
    sha = (await getRes.json()).sha;
  } else {
    return new Response('Read archive file failed', { status: 502, headers: getCORSHeaders(request) });
  }

  const base64File = encodeBase64Bytes(await newFile.arrayBuffer());
  const putRes = await fetch(fileUrl, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'OpenST-Portal',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Replace Resource: ${newFileName}`,
      content: base64File,
      ...(sha ? { sha } : {}),
      branch: 'main',
    }),
  });

  if (!putRes.ok) {
    return new Response(JSON.stringify({ success: false, error: 'GitHub write failed' }), {
      status: 502,
      headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
    });
  }

  // 删除旧存档，保证 archive CI 只看到一个资源文件
  const cleanup = await cleanupItemFiles(
    token,
    config.archiveRepo,
    prefix,
    (name) => name !== newFileName && ARCHIVE_FILE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)),
  );
  await invalidateItemIndex();

  return new Response(JSON.stringify({ success: true, filename: newFileName, cleanup }), {
    headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
  });
}

export async function handleDeleteArchive({ request, config, proxyToken }) {
  const auth = requireAdmin(request, proxyToken);
  if (auth.response) return auth.response;
  const token = auth.token;

  const { folder } = await request.json();
  if (!isSafeFolder(folder)) {
    return new Response('Invalid folder', { status: 400, headers: getCORSHeaders(request) });
  }

  // 经定位表解析稿件在稿件库中的真实路径
  const prefix = await resolveItemPrefix(token, config.archiveRepo, folder);
  if (!prefix) {
    return new Response('Archive not found', { status: 404, headers: getCORSHeaders(request) });
  }

  // 稿件库分支头
  const branchRes = await fetch(`https://api.github.com/repos/${config.archiveRepo}/branches/main`, {
    headers: { Authorization: `token ${token}`, 'User-Agent': 'OpenST-Portal' },
  });
  const branchData = await branchRes.json();
  if (!branchRes.ok || !branchData.commit) {
    return new Response('Archive repo unavailable', { status: 502, headers: getCORSHeaders(request) });
  }
  const baseTreeSha = branchData.commit.commit.tree.sha;

  // 基于 base_tree 的最小变更树：将整个稿件目录置空即删除（支持目录级）
  const delTreeRes = await fetch(`https://api.github.com/repos/${config.archiveRepo}/git/trees`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'OpenST-Portal',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: [
        {
          path: prefix,
          mode: '040000',
          type: 'tree',
          sha: null,
        },
      ],
    }),
  });
  const delTreeData = await delTreeRes.json();
  if (!delTreeRes.ok || !delTreeData.sha) {
    return new Response(JSON.stringify({ success: false, error: 'Build tree failed' }), {
      status: 502,
      headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
    });
  }

  const commitRes = await fetch(`https://api.github.com/repos/${config.archiveRepo}/git/commits`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'OpenST-Portal',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Permanent Delete Folder: ${folder}`,
      tree: delTreeData.sha,
      parents: [branchData.commit.sha],
    }),
  });
  const newCommitData = await commitRes.json();
  if (!commitRes.ok || !newCommitData.sha) {
    return new Response(JSON.stringify({ success: false, error: 'Create commit failed' }), {
      status: 502,
      headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
    });
  }

  const updateRefRes = await fetch(`https://api.github.com/repos/${config.archiveRepo}/git/refs/heads/main`, {
    method: 'PATCH',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'OpenST-Portal',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sha: newCommitData.sha }),
  });

  if (!updateRefRes.ok) {
    return new Response(JSON.stringify({ success: false, error: 'Update ref failed' }), {
      status: 502,
      headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
    });
  }

  await invalidateItemIndex();
  return new Response(JSON.stringify({ success: true, folderRemoved: folder }), {
    headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
  });
}
