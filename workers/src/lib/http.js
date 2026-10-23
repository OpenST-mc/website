// CORS、Cookie、CSRF 与单 isolate 限流。
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4000',
  'https://openstmc.com',
  'https://www.openstmc.com',
  'https://wiki.openstmc.com',
];

// 动态跨域头：只回显白名单来源，默认站点主域。
export function getCORSHeaders(request) {
  const origin = request.headers.get('Origin');
  const headerOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[2];

  return {
    'Access-Control-Allow-Origin': headerOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-openst-upload-token, x-openst-upload-user',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export function handleCORS(request) {
  return new Response(null, { headers: getCORSHeaders(request) });
}

// 浏览器请求必须携带合法 Origin；非浏览器请求无 Origin，放行。
export function checkCSRF(request) {
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response('Forbidden', { status: 403, headers: getCORSHeaders(request) });
  }
  return null;
}

// 从 HttpOnly Cookie 或 Authorization 头解析认证 token。
export function getAuthToken(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('gh_token='));
  if (match) return decodeURIComponent(match.slice('gh_token='.length));
  return request.headers.get('Authorization')?.replace('Bearer ', '') || null;
}

// 构建 HttpOnly 认证 Cookie（7 天有效）。
export function buildAuthCookie(token) {
  return `gh_token=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=604800`;
}

export function clearAuthCookie() {
  return 'gh_token=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0';
}

// 轻量内存滑动窗口限流（单 isolate 生效，生产建议叠加 CF WAF 限速规则）。
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateBuckets = new Map();

// 命中一次限流桶；返回是否超限。
export function hitRateBucket(bucketKey) {
  const now = Date.now();

  let bucket = rateBuckets.get(bucketKey);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  }
  bucket.count++;
  rateBuckets.set(bucketKey, bucket);

  // 过期桶清理，防止内存膨胀
  if (rateBuckets.size > 10000) {
    for (const [k, v] of rateBuckets) {
      if (now > v.resetAt) rateBuckets.delete(k);
    }
  }

  return bucket.count > RATE_LIMIT_MAX;
}

export function isRateLimited(request, key) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  return hitRateBucket(`${ip}:${key}`);
}
