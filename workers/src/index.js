// OpenST API Hub V5.1 "Universal Portal" (Security Enhanced)
import { getConfig } from './lib/config.js';
import { verifyWorkerProxy } from './lib/crypto.js';
import { getCORSHeaders, handleCORS } from './lib/http.js';
import { handleCheckAdmin, handleExchangeToken, handleLogout, handleSession } from './routes/auth.js';
import { handleDeleteArchive, handleReplaceLitematic, handleUpdateInfo, handleUpdatePreview } from './routes/admin.js';
import {
  handleArchiveUpload,
  handleDownload,
  handleHealth,
  handleSubmitIssue,
  handleWikiSubmit,
} from './routes/public.js';

export default {
  async fetch(request, env) {
    // --- [安全防线 0]：代码级数据中心与恶意请求清洗 (防刷兜底) ---
    const cf = request.cf || {};
    const asn = cf.asn || cf.geoip?.asnum;

    // 黑名单 ASN 从环境变量读取（逗号分隔），便于动态更新
    const blacklistAsns = (env.BLACKLIST_ASNS || '132203,133478')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n));
    if (blacklistAsns.includes(asn)) {
      // 携带 CORS 头与 ASN 诊断信息，便于被误伤的访问者排查
      return new Response(JSON.stringify({ error: 'Blocked Infrastructure', asn: asn }), {
        status: 403,
        headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return handleCORS(request);
    }

    // --- [安全防线 1]：从 env 安全注入密钥，杜绝明文泄露 ---
    const config = getConfig(env);

    try {
      // --- [0] 方案 B（ADR-005）：Vercel 已认证代理的服务签名（仅 admin 端点）---
      let proxyToken = null;
      if (url.pathname.startsWith('/api/admin/') || url.pathname === '/api/submit-issue') {
        const proxy = await verifyWorkerProxy(request, env);
        const hasSig = request.headers.get('x-openst-proxy-sig');
        if (proxy) proxyToken = proxy.token;
        else if (hasSig) {
          return new Response('Invalid proxy signature', { status: 403, headers: getCORSHeaders(request) });
        }
      }

      // --- [1] OAuth 令牌交换 (token 仅写入 HttpOnly Cookie，绝不回传前端) ---
      if (url.pathname === '/api/exchange-token') {
        return handleExchangeToken({ request, url, config });
      }

      // --- [2] 会话查询 (读取 HttpOnly Cookie，返回用户与权限) ---
      if (url.pathname === '/api/session') {
        return handleSession({ request, config });
      }

      // --- [2.1] 退出登录 (清除 HttpOnly Cookie) ---
      if (url.pathname === '/api/logout' && request.method === 'POST') {
        return handleLogout({ request });
      }

      // --- [2.2] 会话查询别名 (兼容 WAF 白名单路径；?logout=1 时登出) ---
      if (url.pathname === '/api/check-admin') {
        return handleCheckAdmin({ request, url, config });
      }

      // --- [3] 管理员修改数据 (按字段合并 info.json) ---
      if (url.pathname === '/api/admin/update-info' && request.method === 'POST') {
        return handleUpdateInfo({ request, config, proxyToken });
      }

      // --- [3.1] 更换预览图（写 preview.* 源图，派生图由 archive CI 重建）---
      if (url.pathname === '/api/admin/update-preview' && request.method === 'POST') {
        return handleUpdatePreview({ request, config, proxyToken });
      }

      // --- [3.3] 管理员专项替换资源文件（filename / sha256 由 archive CI 重新派生）---
      if (url.pathname === '/api/admin/replace-litematic' && request.method === 'POST') {
        return handleReplaceLitematic({ request, config, proxyToken });
      }

      // --- [3.4] 彻底删除稿件文件夹 ---
      if (url.pathname === '/api/admin/delete-archive' && request.method === 'POST') {
        return handleDeleteArchive({ request, config, proxyToken });
      }

      // --- [4] 投稿中继（需登录：Vercel /api/upload-token 签发的短时令牌）---
      if (
        request.method === 'POST' &&
        (url.pathname === '/api/archive-upload' || url.pathname === '/api/archive-upload/')
      ) {
        return handleArchiveUpload({ request, env, url, config });
      }

      // --- [5] 下载代理：动态获取模式 ---
      if (url.pathname.startsWith('/dl/')) {
        return handleDownload({ request, url, config });
      }

      // --- [5.1] 投稿 Issue 代理 (前端不再直接持有 token 访问 GitHub) ---
      if (url.pathname === '/api/submit-issue' && request.method === 'POST') {
        return handleSubmitIssue({ request, proxyToken });
      }

      // --- 健康检查 ---
      if (url.pathname === '/health') {
        return handleHealth({ request });
      }

      // --- [6] Wiki 专用提交 ---
      if (url.pathname === '/api/wiki/submit-archive' && request.method === 'POST') {
        return handleWikiSubmit({ request, url, config });
      }

      return new Response('OpenST Hub Online', { headers: getCORSHeaders(request) });
    } catch {
      // 生产环境不暴露底层报错细节，避免泄漏内部实现
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...getCORSHeaders(request), 'Content-Type': 'application/json' },
      });
    }
  },
};
