/**
 * OpenST API Hub V5.1 - "Universal Portal" (Security Enhanced Edition)
 */

export default {
    async fetch(request, env) {
        // --- [安全防线 0]：代码级数据中心与恶意请求清洗 (防刷兜底) ---
        const cf = request.cf || {};
        const asn = cf.asn || cf.geoip?.asnum;

        // 屏蔽黑名单 ASN (例如此前攻击你的腾讯云数据中心)
        const BLACKLIST_ASNS = [132203, 133478];
        if (BLACKLIST_ASNS.includes(asn)) {
            return new Response("Access Denied: Blocked Infrastructure", { status: 403 });
        }

        const url = new URL(request.url);

        // 处理预检请求 (CORS OPTIONS)
        if (request.method === "OPTIONS") {
            return handleCORS(request);
        }

        // --- [安全防线 1]：从 env 安全注入密钥，杜绝明文泄露 ---
        const BOT_TOKEN = env.BOT_TOKEN;
        const CHAT_ID = env.CHAT_ID;
        const CLIENT_ID = env.CLIENT_ID;
        const CLIENT_SECRET = env.CLIENT_SECRET;
        const GH_REPO = env.GH_REPO || 'OpenST-mc/website';

        const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

        try {
            // --- [1] OAuth 令牌交换 ---
            if (url.pathname === '/api/exchange-token') {
                const code = url.searchParams.get('code');
                if (!code) {
                    return new Response("Missing code", { status: 400, headers: getCORSHeaders(request) });
                }

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
                return new Response(JSON.stringify(data), {
                    headers: { ...getCORSHeaders(request), "Content-Type": "application/json" }
                });
            }

            // --- [2] 权限校验 ---
            if (url.pathname === '/api/check-admin') {
                const token = request.headers.get('Authorization')?.replace('Bearer ', '');
                if (!token) {
                    return new Response("Unauthorized", { status: 401, headers: getCORSHeaders(request) });
                }

                const ghRes = await fetch(`https://api.github.com/repos/${GH_REPO}`, {
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
                });
                const repoData = await ghRes.json();
                const isAdmin = repoData.permissions?.push === true;

                return new Response(JSON.stringify({ isAdmin }), {
                    headers: { ...getCORSHeaders(request), "Content-Type": "application/json" }
                });
            }

            // --- [3] 管理员修改数据 (修改 info.json) ---
            if (url.pathname === '/api/admin/update-info' && request.method === 'POST') {
                const { folder, newInfo } = await request.json();
                const token = request.headers.get('Authorization')?.replace('Bearer ', '');
                if (!token) {
                    return new Response("Missing Token", { status: 401, headers: getCORSHeaders(request) });
                }

                const infoUrl = `https://api.github.com/repos/${GH_REPO}/contents/archive/${folder}/info.json`;
                const fileRes = await fetch(infoUrl, {
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
                });

                if (!fileRes.ok) {
                    return new Response("Find info.json failed", { status: 404, headers: getCORSHeaders(request) });
                }

                const fileData = await fileRes.json();
                const jsonString = JSON.stringify(newInfo, null, 4);
                const utf8Bytes = new TextEncoder().encode(jsonString);
                const base64Content = btoa(String.fromCharCode(...utf8Bytes));

                const putRes = await fetch(infoUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'User-Agent': 'OpenST-Portal',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `📝 Staff Edit: ${newInfo.name}`,
                        content: base64Content,
                        sha: fileData.sha,
                        branch: "main"
                    })
                });

                return new Response(JSON.stringify({ success: putRes.ok }), {
                    headers: { ...getCORSHeaders(request), "Content-Type": "application/json" }
                });
            }

            // --- [3.1] 更换预览图 ---
            if (url.pathname === '/api/admin/update-preview' && request.method === 'POST') {
                const token = request.headers.get('Authorization')?.replace('Bearer ', '');
                const fd = await request.formData();
                const file = fd.get('file');
                const folder = fd.get('folder');

                const arrayBuffer = await file.arrayBuffer();
                const base64Image = btoa(Array.from(new Uint8Array(arrayBuffer), b => String.fromCharCode(b)).join(''));

                const safeFolder = encodeURIComponent(folder);
                const forcedName = `preview.${file.name.split('.').pop() || 'png'}`;
                const imgPath = `archive/${safeFolder}/${forcedName}`;
                const ghUrl = `https://api.github.com/repos/${GH_REPO}/contents/${imgPath}`;

                const getRes = await fetch(ghUrl, {
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
                });
                let sha = null;
                if (getRes.ok) {
                    const getData = await getRes.json();
                    sha = getData.sha;
                }

                const putRes = await fetch(ghUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'User-Agent': 'OpenST-Portal',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `🖼️ Update Preview: ${folder}`,
                        content: base64Image,
                        sha: sha,
                        branch: "main"
                    })
                });

                if (putRes.ok) {
                    const infoUrl = `https://api.github.com/repos/${GH_REPO}/contents/archive/${safeFolder}/info.json`;
                    const infoRes = await fetch(infoUrl, {
                        headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
                    });

                    if (infoRes.ok) {
                        const infoData = await infoRes.json();
                        // 采用健壮的 Base64 文本流转码处理
                        const rawBinary = atob(infoData.content.replace(/\s/g, ''));
                        const config = JSON.parse(new TextDecoder().decode(Uint8Array.from(rawBinary, c => c.charCodeAt(0))));

                        const oldPreview = config.preview;
                        config.preview = forcedName;

                        const newInfoBytes = new TextEncoder().encode(JSON.stringify(config, null, 4));
                        await fetch(infoUrl, {
                            method: 'PUT',
                            headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' },
                            body: JSON.stringify({
                                message: "🔧 Sync info.json: update preview reference",
                                content: btoa(String.fromCharCode(...newInfoBytes)),
                                sha: infoData.sha,
                                branch: "main"
                            })
                        });

                        const cleanupList = [oldPreview, 'preview.webp'].filter(n => n && n !== forcedName);
                        for (const target of cleanupList) {
                            const delPath = `archive/${safeFolder}/${target}`;
                            const check = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${delPath}`, {
                                headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
                            });
                            if (check.ok) {
                                const delData = await check.json();
                                await fetch(`https://api.github.com/repos/${GH_REPO}/contents/${delPath}`, {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' },
                                    body: JSON.stringify({ message: `🗑️ Cleanup: ${target}`, sha: delData.sha, branch: "main" })
                                });
                            }
                        }
                    }
                }

                const finalData = await putRes.json();
                return new Response(JSON.stringify({ success: putRes.ok, detail: finalData }), {
                    headers: { ...getCORSHeaders(request), "Content-Type": "application/json" },
                    status: putRes.ok ? 200 : 500
                });
            }

            // --- [3.3] 管理员专项替换资源文件 ---
            if (url.pathname === '/api/admin/replace-litematic' && request.method === 'POST') {
                const token = request.headers.get('Authorization')?.replace('Bearer ', '');
                const fd = await request.formData();
                const newFile = fd.get('file');
                const folder = fd.get('folder');

                const safeFolder = encodeURIComponent(folder);
                const infoUrl = `https://api.github.com/repos/${GH_REPO}/contents/archive/${safeFolder}/info.json`;
                const infoRes = await fetch(infoUrl, {
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
                });

                if (!infoRes.ok) {
                    return new Response("Archive info not found", { status: 404, headers: getCORSHeaders(request) });
                }

                const infoData = await infoRes.json();
                const rawBinary = atob(infoData.content.replace(/\s/g, ''));
                const config = JSON.parse(new TextDecoder().decode(Uint8Array.from(rawBinary, c => c.charCodeAt(0))));

                const oldFileName = config.filename;
                const newFileName = newFile.name;

                const arrayBuffer = await newFile.arrayBuffer();
                const base64File = btoa(Array.from(new Uint8Array(arrayBuffer), b => String.fromCharCode(b)).join(''));

                const putRes = await fetch(`https://api.github.com/repos/${GH_REPO}/contents/archive/${safeFolder}/${encodeURIComponent(newFileName)}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'User-Agent': 'OpenST-Portal',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `🔄 Replace Resource: ${newFileName}`,
                        content: base64File,
                        branch: "main"
                    })
                });

                if (putRes.ok) {
                    if (oldFileName && oldFileName !== newFileName) {
                        const oldFileUrl = `https://api.github.com/repos/${GH_REPO}/contents/archive/${safeFolder}/${encodeURIComponent(oldFileName)}`;
                        const oldFileCheck = await fetch(oldFileUrl, {
                            headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
                        });
                        if (oldFileCheck.ok) {
                            const oldFileData = await oldFileCheck.json();
                            await fetch(oldFileUrl, {
                                method: 'DELETE',
                                headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' },
                                body: JSON.stringify({ message: `🗑️ Cleanup Old File: ${oldFileName}`, sha: oldFileData.sha, branch: "main" })
                            });
                        }

                        config.filename = newFileName;
                        const newInfoBytes = new TextEncoder().encode(JSON.stringify(config, null, 4));
                        await fetch(infoUrl, {
                            method: 'PUT',
                            headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' },
                            body: JSON.stringify({
                                message: `🔧 Sync info.json: filename updated to ${newFileName}`,
                                content: btoa(String.fromCharCode(...newInfoBytes)),
                                sha: infoData.sha,
                                branch: "main"
                            })
                        });
                    }
                }

                return new Response(JSON.stringify({ success: putRes.ok }), {
                    headers: { ...getCORSHeaders(request), "Content-Type": "application/json" }
                });
            }

            // --- [3.4] 彻底删除稿件文件夹 ---
            if (url.pathname === '/api/admin/delete-archive' && request.method === 'POST') {
                const token = request.headers.get('Authorization')?.replace('Bearer ', '');
                if (!token) {
                    return new Response("Missing Token", { status: 401, headers: getCORSHeaders(request) });
                }

                const { folder } = await request.json();

                const branchRes = await fetch(`https://api.github.com/repos/${GH_REPO}/branches/main`, {
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
                });
                const branchData = await branchRes.json();
                const baseTreeSha = branchData.commit.commit.tree.sha;

                const rootTreeRes = await fetch(`https://api.github.com/repos/${GH_REPO}/git/trees/${baseTreeSha}`, {
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
                });
                const rootTree = await rootTreeRes.json();
                const archiveEntry = rootTree.tree.find(item => item.path === 'archive');

                if (!archiveEntry) {
                    return new Response("Archive path not found", { status: 404, headers: getCORSHeaders(request) });
                }

                const archiveTreeRes = await fetch(`https://api.github.com/repos/${GH_REPO}/git/trees/${archiveEntry.sha}`, {
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
                });
                const archiveTree = await archiveTreeRes.json();

                const newArchiveTree = archiveTree.tree
                    .filter(item => item.path !== folder)
                    .map(item => ({
                        path: item.path,
                        mode: item.mode,
                        type: item.type,
                        sha: item.sha
                    }));

                const createTreeRes = await fetch(`https://api.github.com/repos/${GH_REPO}/git/trees`, {
                    method: 'POST',
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' },
                    body: JSON.stringify({ tree: newArchiveTree })
                });
                const newArchiveTreeData = await createTreeRes.json();

                const finalTreeRes = await fetch(`https://api.github.com/repos/${GH_REPO}/git/trees`, {
                    method: 'POST',
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' },
                    body: JSON.stringify({
                        base_tree: baseTreeSha,
                        tree: [{
                            path: 'archive',
                            mode: '040000',
                            type: 'tree',
                            sha: newArchiveTreeData.sha
                        }]
                    })
                });
                const finalTreeData = await finalTreeRes.json();

                const commitRes = await fetch(`https://api.github.com/repos/${GH_REPO}/git/commits`, {
                    method: 'POST',
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' },
                    body: JSON.stringify({
                        message: `🗑️ Permanent Delete Folder: ${folder}`,
                        tree: finalTreeData.sha,
                        parents: [branchData.commit.sha]
                    })
                });
                const newCommitData = await commitRes.json();

                const updateRefRes = await fetch(`https://api.github.com/repos/${GH_REPO}/git/refs/heads/main`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' },
                    body: JSON.stringify({ sha: newCommitData.sha })
                });

                return new Response(JSON.stringify({ success: updateRefRes.ok, folderRemoved: folder }), {
                    headers: { ...getCORSHeaders(request), "Content-Type": "application/json" }
                });
            }

            // --- [4] 投稿中继 ---
            if (request.method === 'POST' && (url.pathname === '/api/archive-upload' || url.pathname === '/api/archive-upload/')) {
                const fd = await request.formData();
                const zipFile = fd.get('zip');
                const previewFile = fd.get('preview');
                const name = fd.get('name');

                const photoFd = new FormData();
                photoFd.append('chat_id', CHAT_ID);
                photoFd.append('photo', previewFile);
                photoFd.append('caption', `📦 新投稿：${name}`);
                await fetch(`${TG_API_BASE}/sendPhoto`, { method: 'POST', body: photoFd });

                const docFd = new FormData();
                docFd.append('chat_id', CHAT_ID);
                docFd.append('document', zipFile);

                const docRes = await fetch(`${TG_API_BASE}/sendDocument`, { method: 'POST', body: docFd });
                const docData = await docRes.json();

                const fileInfoRes = await fetch(`${TG_API_BASE}/getFile?file_id=${docData.result.document.file_id}`);
                const fileInfo = await fileInfoRes.json();

                const downloadUrl = `${url.origin}/dl/${docData.result.document.file_id}?fn=Archive_${encodeURIComponent(name)}.zip`;

                return new Response(JSON.stringify({ success: true, filePath: fileInfo.result.file_id, downloadUrl }), {
                    headers: { ...getCORSHeaders(request), "Content-Type": "application/json" }
                });
            }

            // --- [5] 下载代理：动态获取模式 ---
            if (url.pathname.startsWith('/dl/')) {
                const fileId = url.pathname.replace('/dl/', '');
                const customFileName = url.searchParams.get('fn');

                const tgRes = await fetch(`${TG_API_BASE}/getFile?file_id=${fileId}`);
                const tgInfo = await tgRes.json();

                if (!tgInfo.ok) {
                    return new Response("Telegram 文件已失效或已被清理", { status: 410, headers: getCORSHeaders(request) });
                }

                const realPath = tgInfo.result.file_path;
                const fileResponse = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${realPath}`);

                const newHeaders = new Headers(fileResponse.headers);
                // 对公开下载中继允许宽泛的跨域，或保持与根策略一致
                newHeaders.set("Access-Control-Allow-Origin", "*");
                newHeaders.set("Content-Type", "application/octet-stream");

                const finalName = customFileName || realPath.split('/').pop();
                if (finalName) {
                    const safeName = encodeURIComponent(finalName);
                    newHeaders.set("Content-Disposition", `attachment; filename*=UTF-8''${safeName}`);
                }

                return new Response(fileResponse.body, {
                    status: fileResponse.status,
                    headers: newHeaders
                });
            }

            // --- 健康检查 ---
            if (url.pathname === '/health') {
                const startTime = Date.now();
                const cfOfficial = await fetch('https://www.cloudflarestatus.com/api/v2/status.json')
                    .then(r => r.json())
                    .catch(() => ({ status: { description: "Unknown" } }));

                return new Response(JSON.stringify({
                    status: 'Operational',
                    region: request.cf?.colo || 'Edge',
                    latency: Date.now() - startTime,
                    upstream: cfOfficial.status.description,
                    timestamp: startTime
                }), {
                    headers: {
                        ...getCORSHeaders(request),
                        "Content-Type": "application/json",
                        "Cache-Control": "no-store"
                    }
                });
            }

            // --- [6] Wiki 专用提交 ---
            if (url.pathname === '/api/wiki/submit-archive' && request.method === 'POST') {
                const fd = await request.formData();
                const zipFile = fd.get('file');
                const user = fd.get('user');
                const title = fd.get('title');
                const path = fd.get('path');
                const customBody = fd.get('body');
                const token = request.headers.get('Authorization')?.replace('Bearer ', '');

                const docFd = new FormData();
                docFd.append('chat_id', CHAT_ID);
                docFd.append('document', zipFile);
                docFd.append('caption', `📝 Wiki 待审核提交\n👤 贡献者: @${user}\n路径: ${path}`);

                const docRes = await fetch(`${TG_API_BASE}/sendDocument`, { method: 'POST', body: docFd });
                const docData = await docRes.json();
                if (!docData.ok) throw new Error("Telegram Relay Failed");

                const wikiDownloadUrl = `${url.origin}/dl/${docData.result.document.file_id}?fn=Wiki_Pending_${encodeURIComponent(title)}.zip`;
                const finalIssueBody = customBody
                    ? `${customBody}\n\n---\n🔗 **审核资源**: [点击下载提交包 (Zip)](${wikiDownloadUrl})`
                    : `### 📚 Wiki 提交申请\n\n- **提交者**: @${user}\n- **资源包**: [Zip存档](${wikiDownloadUrl})`;

                // 核心修复：将 labels 选项移入 Body 负载，并转化为符合 API 规范的字符串数组
                const issueRes = await fetch(`https://api.github.com/repos/OpenST-mc/Submissions/issues`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${token}`,
                        'User-Agent': 'OpenST-Portal',
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: title,
                        body: finalIssueBody,
                        labels: ['wiki']
                    })
                });

                const issueData = await issueRes.json();
                if (!issueRes.ok) {
                    return new Response(JSON.stringify({ success: false, error: "GitHub Error", detail: issueData }), {
                        status: issueRes.status,
                        headers: { ...getCORSHeaders(request), "Content-Type": "application/json" }
                    });
                }

                return new Response(JSON.stringify({
                    success: true,
                    issueNumber: issueData.number,
                    downloadUrl: wikiDownloadUrl
                }), { headers: { ...getCORSHeaders(request), "Content-Type": "application/json" } });
            }

            return new Response("📡 OpenST Hub Online", { headers: getCORSHeaders(request) });

        } catch (err) {
            // 安全隐患修复：生产环境不直接向前端暴露底层报错细节（防爆栈漏洞泄漏）
            return new Response(JSON.stringify({ error: "Internal Server Error" }), {
                status: 500,
                headers: { ...getCORSHeaders(request), "Content-Type": "application/json" }
            });
        }
    }
};

// 动态跨域头获取逻辑：安全升级，不再盲目允许 *
function getCORSHeaders(request) {
    const origin = request.headers.get("Origin");
    const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:4000",
        "https://openstmc.com",
        "https://www.openstmc.com"
    ];

    const headerOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[2];

    return {
        "Access-Control-Allow-Origin": headerOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true"
    };
}

function handleCORS(request) {
    return new Response(null, { headers: getCORSHeaders(request) });
}