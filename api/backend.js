/**
 * OpenST API Hub V5.1 - "Universal Portal"
 */

const BOT_TOKEN = 'process.env.BOT_TOKEN';
const CHAT_ID   = 'prcess.env.CHAT_ID';
const CLIENT_ID = 'process.env.CLIENT_ID';
const CLIENT_SECRET = 'process.env.CLIENT_SECRET';
const GH_REPO = 'MC-OpenST/website';

const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (request.method === "OPTIONS") return handleCORS();

        try {
            // --- [1] OAuth 令牌交换 ---
            if (url.pathname === '/api/exchange-token') {
                const code = url.searchParams.get('code');
                const res = await fetch('https://github.com/login/oauth/access_token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code: code })
                });
                const data = await res.json();
                if (data.access_token) {
                    const userRes = await fetch('https://api.github.com/user', {
                        headers: { 'Authorization': `token ${data.access_token}`, 'User-Agent': 'OpenST-Portal' }
                    });
                    data.user = await userRes.json();
                }
                return new Response(JSON.stringify(data), { headers: { ...getCORSHeaders(), "Content-Type": "application/json" } });
            }

            // 权限校验
            if (url.pathname === '/api/check-admin') {
                const token = request.headers.get('Authorization')?.replace('Bearer ', '');
                if (!token) return new Response("Unauthorized", { status: 401, headers: getCORSHeaders() });
                const ghRes = await fetch(`https://api.github.com/repos/${GH_REPO}`, {
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
                });
                const repoData = await ghRes.json();
                const isAdmin = repoData.permissions?.push === true;
                return new Response(JSON.stringify({ isAdmin }), { headers: { ...getCORSHeaders(), "Content-Type": "application/json" } });
            }

            // 管理员修改数据
            if (url.pathname === '/api/admin/update-info' && request.method === 'POST') {
                const { folder, newInfo } = await request.json();
                const token = request.headers.get('Authorization')?.replace('Bearer ', '');
                if (!token) return new Response("Missing Token", { status: 401, headers: getCORSHeaders() });
                const infoUrl = `https://api.github.com/repos/${GH_REPO}/contents/archive/${folder}/info.json`;
                const fileRes = await fetch(infoUrl, {
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
                });
                if (!fileRes.ok) return new Response("Find info.json failed", { status: 404, headers: getCORSHeaders() });
                const fileData = await fileRes.json();
                const jsonString = JSON.stringify(newInfo, null, 4);
                const utf8Bytes = new TextEncoder().encode(jsonString);
                const base64Content = btoa(String.fromCharCode(...utf8Bytes));
                const putRes = await fetch(infoUrl, {
                    method: 'PUT',
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal', 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: `📝 Staff Edit: ${newInfo.name}`, content: base64Content, sha: fileData.sha, branch: "main" })
                });
                const finalResult = await putRes.json();
                return new Response(JSON.stringify({ success: putRes.ok, github: finalResult }), {
                    headers: { ...getCORSHeaders(), "Content-Type": "application/json" }
                });
            }

            // 投稿中继
            if (request.method === 'POST' && url.pathname === '/') {
                const fd = await request.formData();
                const zipFile = fd.get('zip');
                const previewFile = fd.get('preview');
                const name = fd.get('name');
                const photoFd = new FormData();
                photoFd.append('chat_id', CHAT_ID); photoFd.append('photo', previewFile); photoFd.append('caption', `📦 新投稿：${name}`);
                await fetch(`${TG_API_BASE}/sendPhoto`, { method: 'POST', body: photoFd });
                const docFd = new FormData();
                docFd.append('chat_id', CHAT_ID); docFd.append('document', zipFile);
                const docRes = await fetch(`${TG_API_BASE}/sendDocument`, { method: 'POST', body: docFd });
                const docData = await docRes.json();
                const fileInfoRes = await fetch(`${TG_API_BASE}/getFile?file_id=${docData.result.document.file_id}`);
                const fileInfo = await fileInfoRes.json();
                return new Response(JSON.stringify({ success: true, filePath: fileInfo.result.file_path }), { headers: { ...getCORSHeaders(), "Content-Type": "application/json" } });
            }

            // 投稿文件下载代理
            if (url.pathname.startsWith('/dl/')) {
                const path = url.pathname.replace('/dl/', '');
                const response = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${path}`);
                const newRes = new Response(response.body, response);
                newRes.headers.set("Access-Control-Allow-Origin", "*");
                return newRes;
            }

            // Wiki 专用：关键逻辑更新
            if (url.pathname === '/api/wiki/submit-archive' && request.method === 'POST') {
                const fd = await request.formData();
                const zipFile = fd.get('file');
                const user = fd.get('user');
                const title = fd.get('title');
                const path = fd.get('path');
                const customBody = fd.get('body'); // 读取来自 app.js 的详细报告
                const token = request.headers.get('Authorization')?.replace('Bearer ', '');

                // 备份至 Telegram
                const docFd = new FormData();
                docFd.append('chat_id', CHAT_ID);
                docFd.append('document', zipFile);
                docFd.append('caption', `📝 Wiki 待审核提交\n👤 贡献者: @${user}\n路径: ${path}`);
                const docRes = await fetch(`${TG_API_BASE}/sendDocument`, { method: 'POST', body: docFd });
                const docData = await docRes.json();
                if (!docData.ok) throw new Error("Telegram Relay Failed");

                const fileInfoRes = await fetch(`${TG_API_BASE}/getFile?file_id=${docData.result.document.file_id}`);
                const fileInfo = await fileInfoRes.json();
                const downloadUrl = `${url.origin}/dl/${fileInfo.result.file_path}`;

                // 缝合详细报告与下载链接
                const finalIssueBody = customBody
                    ? `${customBody}\n\n---\n🔗 **审核资源**: [点击下载提交包 (Zip)](${downloadUrl})`
                    : `### 📚 Wiki 提交申请\n\n- **提交者**: @${user}\n- **资源包**: [Zip存档](${downloadUrl})`;

                // 在 Submissions 仓库创建 Issue
                const issueRes = await fetch(`https://api.github.com/repos/MC-OpenST/Submissions/issues`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${token}`,
                        'User-Agent': 'OpenST-Portal',
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: title,
                        body: finalIssueBody
                    })
                });

                const issueData = await issueRes.json();
                if (!issueRes.ok) {
                    return new Response(JSON.stringify({ success: false, error: "GitHub Error", detail: issueData }), {
                        status: issueRes.status,
                        headers: { ...getCORSHeaders(), "Content-Type": "application/json" }
                    });
                }

                return new Response(JSON.stringify({
                    success: true,
                    issueNumber: issueData.number,
                    downloadUrl: downloadUrl
                }), { headers: { ...getCORSHeaders(), "Content-Type": "application/json" } });
            }

            return new Response("OpenST Hub Online", { headers: getCORSHeaders() });

        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), {
                status: 500,
                headers: { ...getCORSHeaders(), "Content-Type": "application/json" }
            });
        }
    }
};

function getCORSHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
}

function handleCORS() { return new Response(null, { headers: getCORSHeaders() }); }