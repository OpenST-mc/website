// 公开端点：投稿中继、Telegram 下载代理、Issue 提交、健康检查与 Wiki 提交。
import { verifyUploadToken } from '../lib/crypto.js';
import { checkCSRF, getAuthToken, getCORSHeaders, hitRateBucket, isRateLimited } from '../lib/http.js';

export async function handleArchiveUpload({ request, env, url, config }) {
  const uploader = await verifyUploadToken(request, env);
  if (!uploader) {
    return new Response('Unauthorized', { status: 401, headers: getCORSHeaders(request) });
  }

  const csrf = checkCSRF(request);
  if (csrf) return csrf;
  if (isRateLimited(request, 'archive-upload') || hitRateBucket(`upload-user:${uploader.login}`)) {
    return new Response('Too Many Requests', { status: 429, headers: getCORSHeaders(request) });
  }

  // 请求体大小上限，防止超大文件滥用 Telegram 中继
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 50 * 1024 * 1024) {
    return new Response('Payload Too Large', { status: 413, headers: getCORSHeaders(request) });
  }

  const fd = await request.formData();
  const zipFile = fd.get('zip');
  const previewFile = fd.get('preview');
  const name = (fd.get('name') || '').toString().slice(0, 100);

  // 类型校验：预览图必须为图片，压缩包必须为 zip
  if (!previewFile || (previewFile.type && !previewFile.type.startsWith('image/'))) {
    return new Response('Invalid preview file', { status: 400, headers: getCORSHeaders(request) });
  }
  const zipName = ((zipFile && zipFile.name) || '').toLowerCase();
  const zipTypeOk =
    zipFile &&
    (zipFile.type === 'application/zip' || zipFile.type === 'application/x-zip-compressed' || zipName.endsWith('.zip'));
  if (!zipTypeOk) {
    return new Response('Invalid zip file', { status: 400, headers: getCORSHeaders(request) });
  }

  const photoFd = new FormData();
  photoFd.append('chat_id', config.chatId);
  photoFd.append('photo', previewFile);
  photoFd.append('caption', `新投稿：${name}`);

  const docFd = new FormData();
  docFd.append('chat_id', config.chatId);
  docFd.append('document', zipFile);

  // 并发发送预览图与存档压缩包
  const [, docRes] = await Promise.all([
    fetch(`${config.tgApiBase}/sendPhoto`, { method: 'POST', body: photoFd }),
    fetch(`${config.tgApiBase}/sendDocument`, { method: 'POST', body: docFd }),
  ]);
  const docData = await docRes.json();

  const fileInfoRes = await fetch(`${config.tgApiBase}/getFile?file_id=${docData.result.document.file_id}`);
  const fileInfo = await fileInfoRes.json();

  const downloadUrl = `${url.origin}/dl/${docData.result.document.file_id}?fn=Archive_${encodeURIComponent(name)}.zip`;

  return new Response(JSON.stringify({ success: true, filePath: fileInfo.result.file_id, downloadUrl }), {
    headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
  });
}

export async function handleDownload({ request, url, config }) {
  const fileId = url.pathname.replace('/dl/', '');
  const customFileName = url.searchParams.get('fn');

  const tgRes = await fetch(`${config.tgApiBase}/getFile?file_id=${fileId}`);
  const tgInfo = await tgRes.json();

  if (!tgInfo.ok) {
    return new Response('Telegram 文件已失效或已被清理', { status: 410, headers: getCORSHeaders(request) });
  }

  const realPath = tgInfo.result.file_path;
  const fileResponse = await fetch(`https://api.telegram.org/file/bot${config.botToken}/${realPath}`);

  const newHeaders = new Headers(fileResponse.headers);
  // 对公开下载中继允许宽泛的跨域，或保持与根策略一致
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Content-Type', 'application/octet-stream');

  const finalName = customFileName || realPath.split('/').pop();
  if (finalName) {
    const safeName = encodeURIComponent(finalName);
    newHeaders.set('Content-Disposition', `attachment; filename*=UTF-8''${safeName}`);
  }

  return new Response(fileResponse.body, {
    status: fileResponse.status,
    headers: newHeaders,
  });
}

export async function handleSubmitIssue({ request, proxyToken }) {
  const csrf = checkCSRF(request);
  if (csrf) return csrf;
  if (isRateLimited(request, 'submit-issue')) {
    return new Response('Too Many Requests', { status: 429, headers: getCORSHeaders(request) });
  }

  const token = proxyToken || getAuthToken(request);
  if (!token) {
    return new Response('Unauthorized', { status: 401, headers: getCORSHeaders(request) });
  }

  // 请求体大小与字段长度上限
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 100 * 1024) {
    return new Response('Payload Too Large', { status: 413, headers: getCORSHeaders(request) });
  }

  const payload = await request.json();
  const title = String(payload.title || '').slice(0, 256);
  const body = String(payload.body || '').slice(0, 65536);

  if (!title) {
    return new Response('Missing title', { status: 400, headers: getCORSHeaders(request) });
  }

  // labels 白名单，防止任意标签滥用
  const labels = ['档案馆'];

  const issueRes = await fetch('https://api.github.com/repos/OpenST-mc/Submissions/issues', {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'OpenST-Portal',
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: title, body: body, labels: labels }),
  });

  const issueData = await issueRes.json();
  if (!issueRes.ok) {
    return new Response(JSON.stringify({ success: false, error: 'GitHub Error', detail: issueData }), {
      status: issueRes.status,
      headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      issueNumber: issueData.number,
      html_url: issueData.html_url,
    }),
    {
      headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
    },
  );
}

export async function handleHealth({ request }) {
  const startTime = Date.now();
  const cfOfficial = await fetch('https://www.cloudflarestatus.com/api/v2/status.json')
    .then((r) => r.json())
    .catch(() => ({ status: { description: 'Unknown' } }));

  return new Response(
    JSON.stringify({
      status: 'Operational',
      region: request.cf?.colo || 'Edge',
      latency: Date.now() - startTime,
      upstream: cfOfficial.status.description,
      timestamp: startTime,
    }),
    {
      headers: {
        ...getCORSHeaders(request),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    },
  );
}

export async function handleWikiSubmit({ request, url, config }) {
  if (isRateLimited(request, 'wiki-submit')) {
    return new Response('Too Many Requests', { status: 429, headers: getCORSHeaders(request) });
  }

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > 50 * 1024 * 1024) {
    return new Response('Payload Too Large', { status: 413, headers: getCORSHeaders(request) });
  }

  const fd = await request.formData();
  const zipFile = fd.get('file');
  const user = fd.get('user');
  const title = fd.get('title');
  const path = fd.get('path');
  const customBody = fd.get('body');
  const token = getAuthToken(request);

  const docFd = new FormData();
  docFd.append('chat_id', config.chatId);
  docFd.append('document', zipFile);
  docFd.append('caption', `Wiki 待审核提交\n贡献者: @${user}\n路径: ${path}`);

  const docRes = await fetch(`${config.tgApiBase}/sendDocument`, { method: 'POST', body: docFd });
  const docData = await docRes.json();
  if (!docData.ok) throw new Error('Telegram Relay Failed');

  const wikiDownloadUrl = `${url.origin}/dl/${docData.result.document.file_id}?fn=Wiki_Pending_${encodeURIComponent(title)}.zip`;
  const finalIssueBody = customBody
    ? `${customBody}\n\n---\n**审核资源**: [点击下载提交包 (Zip)](${wikiDownloadUrl})`
    : `### Wiki 提交申请\n\n- **提交者**: @${user}\n- **资源包**: [Zip存档](${wikiDownloadUrl})`;

  // 核心修复：将 labels 选项移入 Body 负载，并转化为符合 API 规范的字符串数组
  const issueRes = await fetch(`https://api.github.com/repos/OpenST-mc/Submissions/issues`, {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'OpenST-Portal',
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title,
      body: finalIssueBody,
      labels: ['wiki'],
    }),
  });

  const issueData = await issueRes.json();
  if (!issueRes.ok) {
    return new Response(JSON.stringify({ success: false, error: 'GitHub Error', detail: issueData }), {
      status: issueRes.status,
      headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      issueNumber: issueData.number,
      downloadUrl: wikiDownloadUrl,
    }),
    { headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' } },
  );
}
