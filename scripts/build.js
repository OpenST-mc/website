import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 1. 获取当前脚本的绝对路径 (website/scripts/build.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. 向上跳一级，到达项目根目录 (website/)
const root = path.resolve(__dirname, '..');

// 3. 定义目标路径
const ARCHIVE_DIR = path.join(root, 'archive');
const OUTPUT_FILE = path.join(root, 'data/database.json');

async function build() {
    console.log(`🚀 正在启动自动化构建...`);
    console.log(`📍 项目根目录定位: ${root}`);
    console.log(`🔍 正在扫描存档目录: ${ARCHIVE_DIR}`);

    try {
        // 检查 archive 目录是否存在
        await fs.access(ARCHIVE_DIR);

        const folders = await fs.readdir(ARCHIVE_DIR);
        const database = [];

        for (const folder of folders) {
            // 跳过隐藏文件或 .gitkeep
            if (folder.startsWith('.')) continue;

            const folderPath = path.join(ARCHIVE_DIR, folder);
            const stats = await fs.stat(folderPath);

            // 确保是一个存档文件夹
            if (!stats.isDirectory()) continue;

            try {
                const files = await fs.readdir(folderPath);

                // 查找投影文件或压缩包
                const archiveFile = files.find(f =>
                    ['.litematic', '.zip', '.schem'].some(ext => f.toLowerCase().endsWith(ext))
                );

                // 读取核心元数据 info.json
                const infoPath = path.join(folderPath, 'info.json');
                const infoContent = await fs.readFile(infoPath, 'utf-8');
                const info = JSON.parse(infoContent);

                // 组装数据库条目
                database.push({
                    id: folder,
                    name: info.name || folder,
                    author: info.author || 'Unknown',
                    tags: info.tags || [],
                    description: info.description || '',
                    preview: `archive/${folder}/preview.png`,
                    filename: archiveFile || '',
                    sub_id: info.sub-id || ''
                });

                console.log(`✅ 已收录: ${info.name}`);

            } catch (e) {
                console.warn(`⚠️ 跳过目录 "${folder}": ${e.message}`);
            }
        }

        // 4. 确保 data 目录存在并写入
        const dataDir = path.dirname(OUTPUT_FILE);
        await fs.mkdir(dataDir, { recursive: true });

        // 5. 写入 JSON，使用 4 空格缩进增加可读性
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(database, null, 4));

        console.log(`\n✨ 构建成功！共发现 ${database.length} 个存档作品。`);
        console.log(`💾 数据库已保存至: ${OUTPUT_FILE}`);

    } catch (err) {
        console.error('❌ 致命错误: 无法定位到 archive 目录！');
        console.error(`请确认根目录下存在 archive 文件夹。当前扫描路径: ${ARCHIVE_DIR}`);
        console.error(`错误详情: ${err.message}`);
        process.exit(1);
    }
}

build();
