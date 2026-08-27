// 全局 CSP 禁止内联脚本，跳转一律使用 meta refresh（CSP 不管辖）
function redirectTo(res, url) {
    const safeUrl = String(url)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    res.setHeader("Content-Type", "text/html");
    res.setHeader('Cache-Control', 'no-store');
    res.send(`<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta http-equiv="refresh" content="0;url=${safeUrl}">
</head><body>
<p>正在跳转…<a href="${safeUrl}">如未自动跳转请点此</a></p>
</body></html>`);
}

export default async function handler(req, res) {
    const queryKeys = Object.keys(req.query);
    const subId = req.query.id || queryKeys.find(k => k.startsWith('sub-'));

    // 校验 sub_id 格式（含历史双段 sub-xxx-yyy），拒绝注入载荷
    const safeSubId = typeof subId === 'string' && /^sub-\d+(-\d+)?$/.test(subId) ? subId : null;

    if (!safeSubId) {
        return redirectTo(res, 'https://openstmc.com/archive');
    }

    try {
        const data = await fetch('https://openstmc.com/archive/data/database.json')
            .then(r => r.json());

        const item = data.find(i => i.sub_id === safeSubId);

        if (!item) {
            return redirectTo(res, 'https://openstmc.com/archive');
        }

        // HTML 实体转义，防止属性/脚本注入
        const escapeHtml = (s) => String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const title = `${escapeHtml(item.name)} - OpenST Archive`;
        const desc = escapeHtml(item.description.replace(/[#*`>!-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 150));
        const image = escapeHtml(`https://openstmc.com/${item.preview}`);
        const finalUrl = escapeHtml(`https://openstmc.com/archive?${safeSubId}`);

        const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <link rel="icon" href="https://openstmc.com/images/favicon-2.png">
    
    <meta name="title" content="${title}">
    <meta name="description" content="${desc}">

    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${image}">
    <meta property="og:url" content="${finalUrl}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="OpenST Archive">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${image}">

    <meta itemprop="name" content="${title}">
    <meta itemprop="description" content="${desc}">
    <meta itemprop="image" content="${image}">
</head>
<body style="background: #1a1a1a; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif;">
    <div style="text-align: center;">
        <p>查找稿件中...</p>
        <meta http-equiv="refresh" content="0;url=${finalUrl}">
    </div>
</body>
</html>`;

        res.setHeader("Content-Type", "text/html");
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        res.send(html);
    } catch (e) {
        return redirectTo(res, 'https://openstmc.com/archive');
    }
}
