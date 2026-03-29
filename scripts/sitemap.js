import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// 配置区
const BASE_URL = 'https://openst.qzz.io/';
const DATABASE_PATH = path.join(root, 'data/database.json');
const SITEMAP_PATH = path.join(root, 'sitemap.xml');

async function generate() {
    console.log('📡 开始提取数据生成 Sitemap...');

    try {
        // 1. 读取 database.json
        const rawData = await fs.readFile(DATABASE_PATH, 'utf-8');
        const database = JSON.parse(rawData);

        const now = new Date().toISOString().split('T')[0];

        // 2. 生成 URL 条目
        // 优先使用 sub_id (即 info.json 里的 id)，如果没有则回退到文件夹名 id
        const urls = database.map(item => {
            const id = item.sub_id || item.id;
            const date = (item.submitDate || item.date || new Date().toISOString()).split('T')[0];

            return `
    <url>
        <loc>${BASE_URL}archive.html?id=${id}</loc>
        <lastmod>${date}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
    </url>`;
        }).join('');
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${BASE_URL}</loc>
        <lastmod>${now}</lastmod>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
    <url>
        <loc>${BASE_URL}archive.html</loc>
        <lastmod>${now}</lastmod>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
    </url>${urls}
</urlset>`;
        await fs.writeFile(SITEMAP_PATH, xml.trim());

        async function generateRobots() {
            const root = path.resolve(__dirname, '..');
            const robotsPath = path.join(root, 'robots.txt');
            const content = `User-agent: *
Allow: /

Sitemap: https://openst.qzz.io/sitemap.xml
`;
            await fs.writeFile(robotsPath, content);
            console.log('robots.txt 生成成功！');
        }

        await generateRobots();

        console.log(`\nSitemap 生成成功！`);
        console.log(`\nrobots 生成成功！`)
        console.log(`路径: ${SITEMAP_PATH}`);
        console.log(`总计链接: ${database.length + 2} 条`);

    } catch (err) {
        console.error('Sitemap 生成失败:', err.message);
        process.exit(1);
    }
}

generate();