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

        if (item) {
            // 注入动态 Meta
            const title = `${item.name} - OpenST Archive`;
            const description = item.description.replace(/[#*`>]/g, '').slice(0, 150);
            const image = `https://openstmc.com/${item.preview}`;

            html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);

            const dynamicMeta = `
                <meta name="description" content="${description}">
                <meta property="og:title" content="${title}">
                <meta property="og:description" content="${description}">
                <meta property="og:image" content="${image}">
                <meta property="og:url" content="https://openstmc.com/archive?${subId}">
                <meta name="twitter:card" content="summary_large_image">
            `;
            html = html.replace('<head>', `<head>${dynamicMeta}`);
        }

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(html);
    } catch (e) {
        // 出错则回退到普通页面
        return res.status(200).send(fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8'));
    }
}