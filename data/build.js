import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// 稿件数据来自 OpenST-mc/archive 子模块（content/<分类>/<稿件目录>）
const CONTENT_DIR = path.join(root, 'content');
const OUTPUT_FILE = path.join(root, 'archive/data/database.json');
const RESERVED = ['scripts', 'data', '_meta', 'docs', 'node_modules'];

// 支持的原始图片格式优先顺序
const SUPPORTED_IMG_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

async function processItem(category, folder) {
    if (folder.startsWith('.')) return null;

    const itemPath = path.join(CONTENT_DIR, category, folder);
    try {
        const stats = await fs.stat(itemPath);
        if (!stats.isDirectory()) return null;

        const files = await fs.readdir(itemPath);

        // 查找预览图
        const sourceImg = files.find(f =>
            SUPPORTED_IMG_EXTS.includes(path.extname(f).toLowerCase()) &&
            f.toLowerCase().startsWith('preview')
        );

        let finalPreview = sourceImg ? `content/${category}/${folder}/${sourceImg}` : '';

        if (sourceImg) {
            const sourcePath = path.join(itemPath, sourceImg);
            const webpPath = path.join(itemPath, 'preview.webp');

            try {
                // 预览图以子模块内置的 preview.webp 为准，缺失时本地兜底转换
                await fs.access(webpPath);
                finalPreview = `/content/${category}/${folder}/preview.webp`;
            } catch {
                if (!SOURCE_CONVERSION_WARNED.has(category + '/' + folder)) {
                    SOURCE_CONVERSION_WARNED.add(category + '/' + folder);
                    console.warn(`提示: ${category}/${folder} 缺少 preview.webp，本地生成`);
                }
                try {
                    await sharp(sourcePath)
                        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
                        .webp({ quality: 80, effort: 2 })
                        .toFile(webpPath);
                    finalPreview = `/content/${category}/${folder}/preview.webp`;
                } catch (err) {
                    console.warn(`图片转换失败 ${category}/${folder}: ${err.message}`);
                }
            }
        }

        // 查找存档文件
        const archiveFile = files.find(f =>
            ['.litematic', '.zip', '.rar'].some(ext => f.toLowerCase().endsWith(ext))
        );

        // 读取元数据
        const infoPath = path.join(itemPath, 'info.json');
        const info = JSON.parse(await fs.readFile(infoPath, 'utf-8'));

        console.log(`已处理: ${info.name || folder}`);

        return {
            id: folder,
            name: info.name || folder,
            author: info.author || 'Unknown',
            tags: info.tags || [],
            description: info.description || '',
            category,
            preview: finalPreview,
            filename: archiveFile || '',
            sub_id: info.id || ''
        };
    } catch (e) {
        console.warn(`跳过目录 "${category}/${folder}": ${e.message}`);
        return null;
    }
}

// 已警告集合，避免同一次构建重复刷屏
const SOURCE_CONVERSION_WARNED = new Set();

async function build() {
    console.log(`正在构建稿件数据库（来源: content/ 子模块）...`);
    console.time('构建耗时');

    try {
        // 仅取真正的分类目录（排除 README、package.json 等根级文件）
        const candidateNames = await fs.readdir(CONTENT_DIR);
        const categories = [];
        for (const name of candidateNames) {
            if (name.startsWith('.') || RESERVED.includes(name)) continue;
            const st = await fs.stat(path.join(CONTENT_DIR, name));
            if (st.isDirectory()) categories.push(name);
        }

        const pairs = [];
        for (const c of categories.sort()) {
            const items = await fs.readdir(path.join(CONTENT_DIR, c));
            for (const f of items) pairs.push([c, f]);
        }

        // 并发处理所有稿件
        const results = await Promise.all(pairs.map(([c, f]) => processItem(c, f)));

        // 过滤无效项并写入
        const database = results.filter(item => item !== null);

        const dataDir = path.dirname(OUTPUT_FILE);
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(database, null, 4));

        console.log(`\n构建成功！共发现 ${database.length} 个稿件。`);
        console.timeEnd('构建耗时');

    } catch (err) {
        console.error('错误:', err.message);
        process.exit(1);
    }
}

build();
