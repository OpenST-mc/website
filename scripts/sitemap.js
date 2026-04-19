import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const CONFIG = {
    BASE_URL: 'https://openstmc.com/',
    DATABASE_PATH: path.join(root, 'data/database.json'),
    SITEMAP_PATH: path.join(root, 'sitemap.xml'),
    ROBOTS_PATH: path.join(root, 'robots.txt')
};

// 格式化时间为 ISO 8601 (例如: 2026-03-30T12:00:00Z)

function formatFullDate(dateStr) {
    try {
        const d = dateStr ? new Date(dateStr) : new Date();
        return d.toISOString();
    } catch (e) {
        return new Date().toISOString();
    }
}

async function generate() {
    console.log('📡 正在生成旗舰级 Sitemap & Robots...');

    try {
        // 1. 读取数据
        const rawData = await fs.readFile(CONFIG.DATABASE_PATH, 'utf-8');
        const database = JSON.parse(rawData);
        const now = formatFullDate();

        // 2. 生成动态 URL 条目
        const urls = database.map(item => {
            const id = item.sub_id || item.id;
            const date = formatFullDate(item.submitDate || item.date);

            return `  <url>
    <loc>${CONFIG.BASE_URL}archive?${id}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.80</priority>
  </url>`;
        }).join('\n');

        // 3. 构建严格校验格式的 XML
        // 注意：移除了注释，确保 <?xml 是文件第一个字符
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
      xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
            http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
  <url>
    <loc>${CONFIG.BASE_URL}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.00</priority>
  </url>
  <url>
    <loc>${CONFIG.BASE_URL}archive</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.90</priority>
  </url>
${urls}
</urlset>`;

        // 4. 写入文件
        await fs.writeFile(CONFIG.SITEMAP_PATH, xml.trim());

        // 5. 生成 robots.txt (使用统一的域名变量)
        const robotsContent = `User-agent: *
Allow: /

Sitemap: ${CONFIG.BASE_URL}sitemap.xml
`;
        await fs.writeFile(CONFIG.ROBOTS_PATH, robotsContent);

        console.log('------------------------------------');
        console.log(`✅ 成功！已生成 ${database.length + 2} 条链接`);
        console.log(`🌐 当前域名: ${CONFIG.BASE_URL}`);
        console.log(`📄 站点地图: ${CONFIG.SITEMAP_PATH}`);
        console.log(`🤖 机器人文件: ${CONFIG.ROBOTS_PATH}`);
        console.log('------------------------------------');

    } catch (err) {
        console.error('❌ 生成失败:', err.message);
        process.exit(1);
    }
}

generate();