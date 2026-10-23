// OAuth 令牌交换、会话查询与登出。
import { sha256Hex } from '../lib/crypto.js';
import { resolveSession, writeSessionCache } from '../lib/github.js';
import {
  buildAuthCookie,
  checkCSRF,
  clearAuthCookie,
  getAuthToken,
  getCORSHeaders,
  isRateLimited,
} from '../lib/http.js';

export async function handleExchangeToken({ request, url, config }) {
  const csrf = checkCSRF(request);
  if (csrf) return csrf;
  if (isRateLimited(request, 'exchange-token')) {
    return new Response('Too Many Requests', { status: 429, headers: getCORSHeaders(request) });
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return new Response('Missing code', { status: 400, headers: getCORSHeaders(request) });
  }

  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code }),
  });
  const data = await res.json();

  if (!data.access_token) {
    return new Response(JSON.stringify({ error: 'Token exchange failed' }), {
      status: 401,
      headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
    });
  }

  // 并发拉取用户信息与仓库权限，减少串行等待
  const [userRes, repoRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${data.access_token}`, 'User-Agent': 'OpenST-Portal' },
    }),
    fetch(`https://api.github.com/repos/${config.ghRepo}`, {
      headers: { Authorization: `token ${data.access_token}`, 'User-Agent': 'OpenST-Portal' },
    }),
  ]);

  const userData = await userRes.json();
  const repoData = await repoRes.json();

  const payload = {
    user: {
      login: userData.login,
      avatar_url: userData.avatar_url,
    },
    isAdmin: repoData.permissions?.push === true,
  };

  // 预热会话缓存，回调后的 fetchSession 直接命中，不再重复请求 GitHub
  await writeSessionCache(await sha256Hex(data.access_token), payload);

  return new Response(JSON.stringify(payload), {
    headers: {
      ...getCORSHeaders(request),
      'Content-Type': 'application/json',
      'Set-Cookie': buildAuthCookie(data.access_token),
    },
  });
}

export async function handleSession({ request, config }) {
  const token = getAuthToken(request);
  if (!token) {
    return new Response(JSON.stringify({ user: null, isAdmin: false }), {
      headers: {
        ...getCORSHeaders(request),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  // 带 10 分钟缓存的会话解析，减少 GitHub API 调用
  const payload = await resolveSession(token, config.ghRepo);
  if (!payload) {
    return new Response(JSON.stringify({ user: null, isAdmin: false }), {
      headers: {
        ...getCORSHeaders(request),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Set-Cookie': clearAuthCookie(),
      },
    });
  }

  return new Response(JSON.stringify(payload), {
    headers: {
      ...getCORSHeaders(request),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export function handleLogout({ request }) {
  const csrf = checkCSRF(request);
  if (csrf) return csrf;

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      ...getCORSHeaders(request),
      'Content-Type': 'application/json',
      'Set-Cookie': clearAuthCookie(),
    },
  });
}

export async function handleCheckAdmin({ request, url, config }) {
  if (url.searchParams.get('logout') === '1') {
    return new Response(JSON.stringify({ user: null, isAdmin: false }), {
      headers: {
        ...getCORSHeaders(request),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Set-Cookie': clearAuthCookie(),
      },
    });
  }

  const token = getAuthToken(request);
  if (!token) {
    return new Response(JSON.stringify({ user: null, isAdmin: false }), {
      headers: {
        ...getCORSHeaders(request),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  // 带 10 分钟缓存的会话解析，减少 GitHub API 调用
  const payload = await resolveSession(token, config.ghRepo);
  if (!payload) {
    return new Response(JSON.stringify({ user: null, isAdmin: false }), {
      headers: {
        ...getCORSHeaders(request),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Set-Cookie': clearAuthCookie(),
      },
    });
  }

  return new Response(JSON.stringify(payload), {
    headers: {
      ...getCORSHeaders(request),
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
