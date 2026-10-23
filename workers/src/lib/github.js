// GitHub 会话校验、稿件定位表缓存与文件清理。
import { sha256Hex } from './crypto.js';

const SESSION_CACHE_TTL = 600;

function sessionCacheKey(tokenHash) {
  return `https://api.openstmc.com/__session_cache/${tokenHash}`;
}

async function readSessionCache(tokenHash) {
  try {
    const cached = await caches.default.match(sessionCacheKey(tokenHash));
    if (!cached) return null;
    return await cached.json();
  } catch {
    return null;
  }
}

export async function writeSessionCache(tokenHash, payload) {
  try {
    await caches.default.put(
      sessionCacheKey(tokenHash),
      new Response(JSON.stringify(payload), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${SESSION_CACHE_TTL}`,
        },
      }),
    );
  } catch {
    // 缓存写入失败不影响会话功能
  }
}

// 校验 token 并解析会话（优先走缓存，减少 GitHub API 调用）。
export async function resolveSession(token, ghRepo) {
  const tokenHash = await sha256Hex(token);

  const cached = await readSessionCache(tokenHash);
  if (cached && cached.user) return cached;

  // 并发校验用户信息与仓库写权限
  const [userRes, repoRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${token}`, 'User-Agent': 'OpenST-Portal' },
    }),
    fetch(`https://api.github.com/repos/${ghRepo}`, {
      headers: { Authorization: `token ${token}`, 'User-Agent': 'OpenST-Portal' },
    }),
  ]);

  // token 失效时不缓存
  if (!userRes.ok) return null;

  const userData = await userRes.json();
  const repoData = await repoRes.json();

  const payload = {
    user: {
      login: userData.login,
      avatar_url: userData.avatar_url,
    },
    isAdmin: repoData.permissions?.push === true,
  };

  await writeSessionCache(tokenHash, payload);
  return payload;
}

// 稿件定位表缓存（稿件库 data/index.json，10 分钟）。
const ITEM_INDEX_URL = 'https://api.openstmc.com/__archive_item_index_v2';

async function fetchItemIndex(archiveRepo) {
  try {
    const cached = await caches.default.match(ITEM_INDEX_URL);
    if (cached) return await cached.json();
  } catch {
    // 缓存读失败则回源
  }

  // data/index.json 同时含稳定 id（entry.id）与真实文件夹（preview 路径倒数第二段），
  // 两种键都登记，兼容深链 sub-id 与管理员沿用的 folder 参数。
  const res = await fetch(`https://raw.githubusercontent.com/${archiveRepo}/main/data/index.json`);
  if (!res.ok) return null;
  const entries = await res.json();
  const index = {};
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const category = typeof entry.category === 'string' ? entry.category : '';
      const preview = typeof entry.preview === 'string' ? entry.preview : '';
      if (!preview.startsWith('/content/') || category.includes('..') || category.includes('\\')) continue;
      const parts = preview.split('/');
      const folder = parts.length >= 2 ? parts[parts.length - 2] : '';
      if (!folder || folder === '.' || folder === '..') continue;
      const location = { category, folder };
      if (typeof entry.id === 'string' && entry.id) index[entry.id] = location;
      index[folder] = location;
    }
  }
  try {
    await caches.default.put(
      ITEM_INDEX_URL,
      new Response(JSON.stringify(index), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${SESSION_CACHE_TTL}`,
        },
      }),
    );
  } catch {
    // 缓存写失败不影响业务
  }
  return index;
}

// 由稳定 sub-id 或稿件文件夹名解析真实相对路径前缀；找不到返回 null。
export async function resolveItemPrefix(token, archiveRepo, key) {
  const index = await fetchItemIndex(archiveRepo);
  const entry = index && index[key];
  if (!entry) return null;
  return entry.category ? `${entry.category}/${entry.folder}` : entry.folder;
}

// 管理员写入后清掉定位表缓存，避免 10 分钟内仍按旧路径操作。
export async function invalidateItemIndex() {
  try {
    await caches.default.delete(ITEM_INDEX_URL);
  } catch {
    // 缓存清理失败不影响写入结果
  }
}

// 串行删除稿件目录内匹配的文件（contents API 每次删除都会产生一次提交）。
export async function cleanupItemFiles(token, archiveRepo, prefix, shouldDelete) {
  const dirUrl = `https://api.github.com/repos/${archiveRepo}/contents/${encodeURIComponent(prefix)}`;
  const res = await fetch(dirUrl, {
    headers: { Authorization: `token ${token}`, 'User-Agent': 'OpenST-Portal' },
  });
  if (!res.ok) return 0;

  const entries = await res.json();
  if (!Array.isArray(entries)) return 0;

  let deleted = 0;
  for (const entry of entries) {
    if (!entry || entry.type !== 'file' || typeof entry.name !== 'string' || !entry.sha) continue;
    if (!shouldDelete(entry.name)) continue;

    const fileUrl = `${dirUrl}/${encodeURIComponent(entry.name)}`;
    const delRes = await fetch(fileUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `token ${token}`,
        'User-Agent': 'OpenST-Portal',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Cleanup: ${entry.name}`,
        sha: entry.sha,
        branch: 'main',
      }),
    });
    if (delRes.ok) deleted += 1;
  }
  return deleted;
}
