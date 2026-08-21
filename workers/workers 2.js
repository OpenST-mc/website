/**
 * OpenST API Hub V5.1 - "Universal Portal" (Security Enhanced Edition)
 */

export default {
    async fetch(request, env) {
        // --- [安全防线 0]：代码级数据中心与恶意请求清洗 (防刷兜底) ---
        const cf = request.cf || {};
        const asn = cf.asn || cf.geoip?.asnum;

        // 黑名单 ASN 从环境变量读取（逗号分隔），便于动态更新
        const blacklistAsns = (env.BLACKLIST_ASNS || '132203,133478')
            .split(',')
            .map(s => Number(s.trim()))
            .filter(n => !isNaN(n));
        if (blacklistAsns.includes(asn)) {
            // 携带 CORS 头与 ASN 诊断信息，便于被误伤的访问者排查
            return new Response(JSON.stringify({ error: "Blocked Infrastructure", asn: asn }), {
                status: 403,
                headers: { ...getCORSHeaders(request), "Content-Type": "application/json" }
            });
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
            // --- [1] OAuth 令牌交换 (token 仅写入 HttpOnly Cookie，绝不回传前端) ---
            if (url.pathname === '/api/exchange-token') {
                const csrf = checkCSRF(request);
                if (csrf) return csrf;
                if (isRateLimited(request, 'exchange-token')) {
                    return new Response("Too Many Requests", { status: 429, headers: getCORSHeaders(request) });
                }

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

                if (!data.access_token) {
                    return new Response(JSON.stringify({ error: "Token exchange failed" }), {
                        status: 401,
                        headers: { ...getCORSHeaders(request), "Content-Type": "application/json" }
                    });
                }

                // 并发拉取用户信息与仓库权限，减少串行等待
                const [userRes, repoRes] = await Promise.all([
                    fetch('https://api.github.com/user', {
                        headers: { 'Authorization': `token ${data.access_token}`, 'User-Agent': 'OpenST-Portal' }
                    }),
                    fetch(`https://api.github.com/repos/${GH_REPO}`, {
                        headers: { 'Authorization': `token ${data.access_token}`, 'User-Agent': 'OpenST-Portal' }
                    })
                ]);

                const userData = await userRes.json();
                const repoData = await repoRes.json();

                const payload = {
                    user: {
                        login: userData.login,
                        avatar_url: userData.avatar_url
                    },
                    isAdmin: repoData.permissions?.push === true
                };

                // 预热会话缓存，回调后的 fetchSession 直接命中，不再重复请求 GitHub
                await writeSessionCache(await sha256Hex(data.access_token), payload);

                return new Response(JSON.stringify(payload), {
                    headers: {
                        ...getCORSHeaders(request),
                        "Content-Type": "application/json",
                        "Set-Cookie": buildAuthCookie(data.access_token)
                    }
                });
            }

            // --- [2] 会话查询 (读取 HttpOnly Cookie，返回用户与权限) ---
            if (url.pathname === '/api/session') {
                const token = getAuthToken(request);
                if (!token) {
                    return new Response(JSON.stringify({ user: null, isAdmin: false }), {
                        headers: {
                            ...getCORSHeaders(request),
                            "Content-Type": "application/json",
                            "Cache-Control": "no-store"
                        }
                    });
                }

                // 带 10 分钟缓存的会话解析，减少 GitHub API 调用
                const payload = await resolveSession(token, GH_REPO);
                if (!payload) {
                    return new Response(JSON.stringify({ user: null, isAdmin: false }), {
                        headers: {
                            ...getCORSHeaders(request),
                            "Content-Type": "application/json",
                            "Cache-Control": "no-store",
                            "Set-Cookie": clearAuthCookie()
                        }
                    });
                }

                return new Response(JSON.stringify(payload), {
                    headers: {
                        ...getCORSHeaders(request),
                        "Content-Type": "application/json",
                        "Cache-Control": "no-store"
                    }
                });
            }

            // --- [2.1] 退出登录 (清除 HttpOnly Cookie) ---
            if (url.pathname === '/api/logout' && request.method === 'POST') {
                const csrf = checkCSRF(request);
                if (csrf) return csrf;

                return new Response(JSON.stringify({ success: true }), {
                    headers: {
                        ...getCORSHeaders(request),
                        "Content-Type": "application/json",
                        "Set-Cookie": clearAuthCookie()
                    }
                });
            }

            // --- [2.2] 会话查询别名 (兼容 WAF 白名单路径；?logout=1 时登出) ---
            if (url.pathname === '/api/check-admin') {
                if (url.searchParams.get('logout') === '1') {
                    return new Response(JSON.stringify({ user: null, isAdmin: false }), {
                        headers: {
                            ...getCORSHeaders(request),
                            "Content-Type": "application/json",
                            "Cache-Control": "no-store",
                            "Set-Cookie": clearAuthCookie()
                        }
                    });
                }

                const token = getAuthToken(request);
                if (!token) {
                    return new Response(JSON.stringify({ user: null, isAdmin: false }), {
                        headers: {
                            ...getCORSHeaders(request),
                            "Content-Type": "application/json",
                            "Cache-Control": "no-store"
                        }
                    });
                }

                // 带 10 分钟缓存的会话解析，减少 GitHub API 调用
                const payload = await resolveSession(token, GH_REPO);
                if (!payload) {
                    return new Response(JSON.stringify({ user: null, isAdmin: false }), {
                        headers: {
                            ...getCORSHeaders(request),
                            "Content-Type": "application/json",
                            "Cache-Control": "no-store",
                            "Set-Cookie": clearAuthCookie()
                        }
                    });
                }

                return new Response(JSON.stringify(payload), {
                    headers: {
                        ...getCORSHeaders(request),
                        "Content-Type": "application/json",
                        "Cache-Control": "no-store"
                    }
                });
            }

            // --- [3] 管理员修改数据 (修改 info.json) ---
            if (url.pathname === '/api/admin/update-info' && request.method === 'POST') {
                const csrf = checkCSRF(request);
                if (csrf) return csrf;
                if (isRateLimited(request, 'admin')) {
                    return new Response("Too Many Requests", { status: 429, headers: getCORSHeaders(request) });
                }

                const token = getAuthToken(request);
                if (!token) {
                    return new Response("Missing Token", { status: 401, headers: getCORSHeaders(request) });
                }

                const { folder, newInfo } = await request.json();
                if (!isSafeFolder(folder)) {
                    return new Response("Invalid folder", { status: 400, headers: getCORSHeaders(request) });
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
                const csrf = checkCSRF(request);
                if (csrf) return csrf;
                if (isRateLimited(request, 'admin')) {
                    return new Response("Too Many Requests", { status: 429, headers: getCORSHeaders(request) });
                }

                const token = getAuthToken(request);
                if (!token) {
                    return new Response("Missing Token", { status: 401, headers: getCORSHeaders(request) });
                }

                const fd = await request.formData();
                const file = fd.get('file');
                const folder = fd.get('folder');

                if (!isSafeFolder(folder)) {
                    return new Response("Invalid folder", { status: 400, headers: getCORSHeaders(request) });
                }

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
                        // 并发清理旧预览图，缩短串行等待
                        await Promise.all(cleanupList.map(async (target) => {
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
                        }));
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
                const csrf = checkCSRF(request);
                if (csrf) return csrf;
                if (isRateLimited(request, 'admin')) {
                    return new Response("Too Many Requests", { status: 429, headers: getCORSHeaders(request) });
                }

                const token = getAuthToken(request);
                if (!token) {
                    return new Response("Missing Token", { status: 401, headers: getCORSHeaders(request) });
                }

                const fd = await request.formData();
                const newFile = fd.get('file');
                const folder = fd.get('folder');

                if (!isSafeFolder(folder)) {
                    return new Response("Invalid folder", { status: 400, headers: getCORSHeaders(request) });
                }

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
                        config.filename = newFileName;

                        const tasks = [];

                        const oldFileUrl = `https://api.github.com/repos/${GH_REPO}/contents/archive/${safeFolder}/${encodeURIComponent(oldFileName)}`;
                        tasks.push((async () => {
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
                        })());

                        tasks.push((async () => {
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
                        })());

                        // 并发执行旧文件删除与 info.json 同步
                        await Promise.all(tasks);
                    }
                }

                return new Response(JSON.stringify({ success: putRes.ok }), {
                    headers: { ...getCORSHeaders(request), "Content-Type": "application/json" }
                });
            }

            // --- [3.4] 彻底删除稿件文件夹 ---
            if (url.pathname === '/api/admin/delete-archive' && request.method === 'POST') {
                const csrf = checkCSRF(request);
                if (csrf) return csrf;
                if (isRateLimited(request, 'admin')) {
                    return new Response("Too Many Requests", { status: 429, headers: getCORSHeaders(request) });
                }

                const token = getAuthToken(request);
                if (!token) {
                    return new Response("Missing Token", { status: 401, headers: getCORSHeaders(request) });
                }

                const { folder } = await request.json();
                if (!isSafeFolder(folder)) {
                    return new Response("Invalid folder", { status: 400, headers: getCORSHeaders(request) });
                }

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
                const csrf = checkCSRF(request);
                if (csrf) return csrf;
                if (isRateLimited(request, 'archive-upload')) {
                    return new Response("Too Many Requests", { status: 429, headers: getCORSHeaders(request) });
                }

                // 请求体大小上限，防止超大文件滥用 Telegram 中继
                const contentLength = Number(request.headers.get('Content-Length') || 0);
                if (contentLength > 50 * 1024 * 1024) {
                    return new Response("Payload Too Large", { status: 413, headers: getCORSHeaders(request) });
                }

                const fd = await request.formData();
                const zipFile = fd.get('zip');
                const previewFile = fd.get('preview');
                const name = (fd.get('name') || '').toString().slice(0, 100);

                // 类型校验：预览图必须为图片，压缩包必须为 zip
                if (!previewFile || (previewFile.type && !previewFile.type.startsWith('image/'))) {
                    return new Response("Invalid preview file", { status: 400, headers: getCORSHeaders(request) });
                }
                const zipName = (zipFile && zipFile.name || '').toLowerCase();
                const zipTypeOk = zipFile && (
                    zipFile.type === 'application/zip' ||
                    zipFile.type === 'application/x-zip-compressed' ||
                    zipName.endsWith('.zip')
                );
                if (!zipTypeOk) {
                    return new Response("Invalid zip file", { status: 400, headers: getCORSHeaders(request) });
                }

                const photoFd = new FormData();
                photoFd.append('chat_id', CHAT_ID);
                photoFd.append('photo', previewFile);
                photoFd.append('caption', `📦 新投稿：${name}`);

                const docFd = new FormData();
                docFd.append('chat_id', CHAT_ID);
                docFd.append('document', zipFile);

                // 并发发送预览图与存档压缩包
                const [, docRes] = await Promise.all([
                    fetch(`${TG_API_BASE}/sendPhoto`, { method: 'POST', body: photoFd }),
                    fetch(`${TG_API_BASE}/sendDocument`, { method: 'POST', body: docFd })
                ]);
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

            // --- [5.1] 投稿 Issue 代理 (前端不再直接持有 token 访问 GitHub) ---
            if (url.pathname === '/api/submit-issue' && request.method === 'POST') {
                const csrf = checkCSRF(request);
                if (csrf) return csrf;
                if (isRateLimited(request, 'submit-issue')) {
                    return new Response("Too Many Requests", { status: 429, headers: getCORSHeaders(request) });
                }

                const token = getAuthToken(request);
                if (!token) {
                    return new Response("Unauthorized", { status: 401, headers: getCORSHeaders(request) });
                }

                // 请求体大小与字段长度上限
                const contentLength = Number(request.headers.get('Content-Length') || 0);
                if (contentLength > 100 * 1024) {
                    return new Response("Payload Too Large", { status: 413, headers: getCORSHeaders(request) });
                }

                const payload = await request.json();
                const title = String(payload.title || '').slice(0, 256);
                const body = String(payload.body || '').slice(0, 65536);
                if (!title) {
                    return new Response("Missing title", { status: 400, headers: getCORSHeaders(request) });
                }

                // labels 白名单，防止任意标签滥用
                const labels = ['档案馆'];

                const issueRes = await fetch('https://api.github.com/repos/OpenST-mc/Submissions/issues', {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${token}`,
                        'User-Agent': 'OpenST-Portal',
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ title: title, body: body, labels: labels })
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
                    html_url: issueData.html_url
                }), {
                    headers: { ...getCORSHeaders(request), "Content-Type": "application/json" }
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
                if (isRateLimited(request, 'wiki-submit')) {
                    return new Response("Too Many Requests", { status: 429, headers: getCORSHeaders(request) });
                }

                const contentLength = Number(request.headers.get('Content-Length') || 0);
                if (contentLength > 50 * 1024 * 1024) {
                    return new Response("Payload Too Large", { status: 413, headers: getCORSHeaders(request) });
                }

                const fd = await request.formData();
                const zipFile = fd.get('file');
                const user = fd.get('user');
                const title = fd.get('title');
                const path = fd.get('path');
                const customBody = fd.get('body');
                const token = getAuthToken(request);

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

// 允许的跨域来源（CORS 与 CSRF 校验共用）
const ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:4000",
    "https://openstmc.com",
    "https://www.openstmc.com",
    "https://wiki.openstmc.com"
];

// 动态跨域头获取逻辑：安全升级，不再盲目允许 *
function getCORSHeaders(request) {
    const origin = request.headers.get("Origin");
    const headerOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[2];

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

// 从 HttpOnly Cookie 或 Authorization 头解析认证 token
function getAuthToken(request) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith('gh_token='));
    if (match) return decodeURIComponent(match.slice('gh_token='.length));
    return request.headers.get('Authorization')?.replace('Bearer ', '') || null;
}

// 构建 HttpOnly 认证 Cookie（7 天有效）
function buildAuthCookie(token) {
    return `gh_token=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=604800`;
}

// 清除认证 Cookie
function clearAuthCookie() {
    return `gh_token=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
}

// 计算 SHA-256 哈希（用于会话缓存键，避免明文 token 进入缓存键）
async function sha256Hex(text) {
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 会话缓存 TTL（秒）：同一 token 10 分钟内复用校验结果
const SESSION_CACHE_TTL = 600;

function sessionCacheKey(tokenHash) {
    return `https://api.openstmc.com/__session_cache/${tokenHash}`;
}

async function readSessionCache(tokenHash) {
    try {
        const cached = await caches.default.match(sessionCacheKey(tokenHash));
        if (!cached) return null;
        return await cached.json();
    } catch (e) {
        return null;
    }
}

async function writeSessionCache(tokenHash, payload) {
    try {
        await caches.default.put(sessionCacheKey(tokenHash), new Response(JSON.stringify(payload), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${SESSION_CACHE_TTL}`
            }
        }));
    } catch (e) {
        // 缓存写入失败不影响会话功能
    }
}

// 校验 token 并解析会话（优先走缓存，减少 GitHub API 调用）
async function resolveSession(token, ghRepo) {
    const tokenHash = await sha256Hex(token);

    const cached = await readSessionCache(tokenHash);
    if (cached && cached.user) return cached;

    // 并发校验用户信息与仓库写权限
    const [userRes, repoRes] = await Promise.all([
        fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
        }),
        fetch(`https://api.github.com/repos/${ghRepo}`, {
            headers: { 'Authorization': `token ${token}`, 'User-Agent': 'OpenST-Portal' }
        })
    ]);

    // token 失效时不缓存
    if (!userRes.ok) return null;

    const userData = await userRes.json();
    const repoData = await repoRes.json();

    const payload = {
        user: {
            login: userData.login,
            avatar_url: userData.avatar_url
        },
        isAdmin: repoData.permissions?.push === true
    };

    await writeSessionCache(tokenHash, payload);
    return payload;
}

// CSRF 校验：浏览器请求必须携带合法 Origin（非浏览器请求无 Origin，放行）
function checkCSRF(request) {
    const origin = request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return new Response("Forbidden", { status: 403, headers: getCORSHeaders(request) });
    }
    return null;
}

// 轻量内存滑动窗口限流（单 isolate 生效，生产建议叠加 CF WAF 限速规则）
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const rateBuckets = new Map();

function isRateLimited(request, key) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const bucketKey = `${ip}:${key}`;
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

// 校验稿件文件夹名，防止路径穿越
function isSafeFolder(folder) {
    return typeof folder === 'string' &&
        folder.length > 0 && folder.length <= 100 &&
        !folder.includes('/') && !folder.includes('\\') &&
        folder !== '.' && folder !== '..';
}