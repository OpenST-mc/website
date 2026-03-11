// [...path].js
export const runtime = 'edge';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const GH_REPO = 'MC-OpenST/website';
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export default async function (request) {
    const url = new URL(request.url);
    const path = url.pathname; // 完整路径
    if (request.method === "OPTIONS") return handleCORS();

    try {
        // /api/exchange-token
        if (path === '/api/exchange-token') {
            const code = url.searchParams.get('code');
            if (!code) return new Response(JSON.stringify({ error: "Missing code" }), { status: 400, headers: getJSONCORS() });

            const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code })
            });
            const tokenData = await tokenRes.json();

            if (tokenData.access_token) {
                const userRes = await fetch('https://api.github.com/user', {
                    headers: { 'Authorization': `token ${tokenData.access_token}`, 'User-Agent': 'OpenST-Portal' }
                });
                tokenData.user = await userRes.json();
            }

            return new Response(JSON.stringify(tokenData), { headers: getJSONCORS() });
        }

        // /api/check-admin
        if (path === '/api/check-admin') {
            const token = request.headers.get('Authorization')?.replace('Bearer ', '');
            if (!token) return new Response("Unauthorized", { status: 401, headers: getCORSHeaders() });

            const ghRes = await fetch(`https://api.github.com/repos/${GH_REPO}`, {
                headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
            });
            const repoData = await ghRes.json();
            return new Response(JSON.stringify({ isAdmin: repoData.permissions?.push === true }), { headers: getJSONCORS() });
        }

        // /api/admin/update-info
        if (path === '/api/admin/update-info' && request.method === 'POST') {
            const token = request.headers.get('Authorization')?.replace('Bearer ', '');
            if (!token) return new Response("Missing Token", { status: 401, headers: getCORSHeaders() });

            const { folder, newInfo } = await request.json();
            const infoUrl = `https://api.github.com/repos/${GH_REPO}/contents/archive/${folder}/info.json`;
            const fileRes = await fetch(infoUrl, { headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' } });
            if (!fileRes.ok) return new Response("Find info.json failed", { status: 404, headers: getCORSHeaders() });

            const fileData = await fileRes.json();
            const base64Content = btoa(JSON.stringify(newInfo, null, 4));
            const putRes = await fetch(infoUrl, {
                method: 'PUT',
                headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal', 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `📝 Staff Edit: ${newInfo.name}`, content: base64Content, sha: fileData.sha, branch: "main" })
            });
            const finalResult = await putRes.json();

            return new Response(JSON.stringify({ success: putRes.ok, github: finalResult }), { headers: getJSONCORS() });
        }

        // 投稿中继 POST /
        if (request.method === 'POST' && path === '/') {
            const fd = await request.formData();
            const zipFile = fd.get('zip');
            const previewFile = fd.get('preview');
            const name = fd.get('name');

            // 先发送预览图
            const photoFd = new FormData();
            photoFd.append('chat_id', CHAT_ID);
            photoFd.append('photo', previewFile);
            photoFd.append('caption', `📦 新投稿：${name}`);
            await fetch(`${TG_API_BASE}/sendPhoto`, { method: 'POST', body: photoFd });

            // 再发送文件
            const docFd = new FormData();
            docFd.append('chat_id', CHAT_ID);
            docFd.append('document', zipFile);
            const docRes = await fetch(`${TG_API_BASE}/sendDocument`, { method: 'POST', body: docFd });
            const docData = await docRes.json();

            const fileInfoRes = await fetch(`${TG_API_BASE}/getFile?file_id=${docData.result.document.file_id}`);
            const fileInfo = await fileInfoRes.json();

            return new Response(JSON.stringify({ success: true, filePath: fileInfo.result.file_path }), { headers: getJSONCORS() });
        }

        // 下载代理 /dl/*
        if (path.startsWith('/dl/')) {
            const telegramPath = path.replace('/dl/', '');
            const resp = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${telegramPath}`);
            const newRes = new Response(resp.body, resp);
            newRes.headers.set("Access-Control-Allow-Origin", "*");
            return newRes;
        }

        // Wiki 提交 /api/wiki/submit-archive
        if (path === '/api/wiki/submit-archive' && request.method === 'POST') {
            const fd = await request.formData();
            const zipFile = fd.get('file');
            const user = fd.get('user');
            const title = fd.get('title');
            const pathParam = fd.get('path');
            const customBody = fd.get('body');
            const token = request.headers.get('Authorization')?.replace('Bearer ', '');

            const docFd = new FormData();
            docFd.append('chat_id', CHAT_ID);
            docFd.append('document', zipFile);
            docFd.append('caption', `📝 Wiki 待审核提交\n👤 贡献者: @${user}\n路径: ${pathParam}`);
            const docRes = await fetch(`${TG_API_BASE}/sendDocument`, { method: 'POST', body: docFd });
            const docData = await docRes.json();
            if (!docData.ok) throw new Error("Telegram Relay Failed");

            const fileInfoRes = await fetch(`${TG_API_BASE}/getFile?file_id=${docData.result.document.file_id}`);
            const fileInfo = await fileInfoRes.json();
            const downloadUrl = `${url.origin}/dl/${fileInfo.result.file_path}`;

            const finalIssueBody = customBody
                ? `${customBody}\n\n---\n🔗 **审核资源**: [点击下载提交包 (Zip)](${downloadUrl})`
                : `### 📚 Wiki 提交申请\n\n- **提交者**: @${user}\n- **资源包**: [Zip存档](${downloadUrl})`;

            const issueRes = await fetch(`https://api.github.com/repos/MC-OpenST/Submissions/issues`, {
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'User-Agent': 'OpenST-Portal',
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title: title, body: finalIssueBody })
            });
            const issueData = await issueRes.json();

            return new Response(JSON.stringify({ success: issueRes.ok, issueNumber: issueData.number, downloadUrl }), { headers: getJSONCORS() });
        }

        return new Response("OpenST Hub Online", { headers: getCORSHeaders() });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: getJSONCORS() });
    }
}

// -------------------
function getCORSHeaders() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
}

function getJSONCORS() {
    return { ...getCORSHeaders(), "Content-Type": "application/json" };
}

function handleCORS() { return new Response(null, { headers: getCORSHeaders() }); }