export default async function handler(req, res) {
    // 自动兼容两种传参：?id=sub-xxx 或直接 ?sub-xxx
    const queryKeys = Object.keys(req.query);
    const subId = req.query.id || queryKeys.find(k => k.startsWith('sub-'));

    try {
        // 从你的线上数据库获取实时数据
        const data = await fetch('https://openstmc.com/data/database.json')
            .then(r => r.json());

        const item = data.find(i => i.sub_id === subId);

        if (!item) {
            // 没找到稿件时，静默跳转回主档案馆，不让用户看报错
            return res.send('<script>location.replace("https://openstmc.com/archive")</script>');
        }

        const title = `${item.name} - OpenST Archive`;
        const desc = item.description.replace(/[#*`>!-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 150);
        const image = `https://openstmc.com/${item.preview}`;
        const finalUrl = `https://openstmc.com/archive.html?${subId}`;

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
        <p>正在进入档案馆...</p>
        <script>location.replace("${finalUrl}");</script>
    </div>
</body>
</html>`;

        res.setHeader("Content-Type", "text/html");
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        res.send(html);
    } catch (e) {
        res.send('<script>location.replace("https://openstmc.com/archive")</script>');
    }
}