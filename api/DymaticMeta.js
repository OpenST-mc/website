import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    const queryKeys = Object.keys(req.query);
    const subId = queryKeys.find(k => k.startsWith('sub-'));

    try {
        const dbPath = path.join(process.cwd(), 'data', 'database.json');
        const htmlPath = path.join(process.cwd(), 'index.html');
        const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        let html = fs.readFileSync(htmlPath, 'utf8');
        const item = dbData.find(entry => entry.sub_id === subId);
        let title = "OpenST Archive - 生电储电档案馆";
        let description = "OpenST 档案馆：归档、转换并在线预览 Minecraft 优秀储电作品。提供精密机器存档下载与 WebGL 投影预览。";
        let image = "https://openstmc.com/images/favicon-1.png";
        let pageUrl = "https://openstmc.com/archive";

        if (item) {
            title = `${item.name} | 作者: ${item.author} - OpenST`;
            // 优化正则
            description = item.description
                .replace(/\[.*\]\(.*\)/g, '')
                .replace(/[#*`>!-]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 150);

            image = `https://openstmc.com/${item.preview}`;
            pageUrl = `https://openstmc.com/archive?${subId}`;
        }

        const dynamicMeta = `
            <title>${title}</title>
            <meta name="title" content="${title}">
            <meta name="description" content="${description}">

            <meta property="og:type" content="article">
            <meta property="og:title" content="${title}">
            <meta property="og:description" content="${description}">
            <meta property="og:image" content="${image}">
            <meta property="og:url" content="${pageUrl}">
            <meta property="og:site_name" content="OpenST Archive">

            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:title" content="${title}">
            <meta name="twitter:description" content="${description}">
            <meta name="twitter:image" content="${image}">

            <meta itemprop="name" content="${title}">
            <meta itemprop="description" content="${description}">
            <meta itemprop="image" content="${image}">
            <link rel="canonical" href="${pageUrl}">
        `;

        // 统一替换逻辑
        html = html.replace(/<title>.*?<\/title>/, '');
        html = html.replace('<head>', `<head>${dynamicMeta}`);
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
    } catch (e) {
        console.error("DymaticMeta Error:", e);
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8'));
    }
}