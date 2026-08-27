import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

// 稿件数据来自 OpenST-mc/archive 子模块
// 目录形态：<一级分类>/<二级标签>/<稿件目录>/ 或无二级时的 <一级分类>/<稿件目录>/
const CONTENT_DIR = path.join(root, 'content');
const OUTPUT_FILE = path.join(root, 'archive/data/database.json');
const RESERVED = ['scripts', 'data', '_meta', 'docs', 'node_modules'];

// 支持的原始图片格式优先顺序
const SUPPORTED_IMG_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

// 已警告集合，避免同一次构建重复刷屏
const SOURCE_CONVERSION_WARNED = new Set();

// 递归收集 content/ 下所有含 info.json 的稿件目录
// category 为相对 content/ 的父路径 posix 形式（'' 表示直接位于根，容错处理）
async function collectItems() {
    const items = [];
    const visit = async (rel) => {
        const abs = path.join(CONTENT_DIR, rel);
        let list;
        try {
            list = await fs.readdir(abs);
        } catch {
            return;
        }
        if (list.includes('info.json')) {
            const relPosix = rel.split(path.sep).join('/');
            items.push({
                category: path.posix.dirname(relPosix) === '.' ? '' : path.posix.dirname(relPosix),
                folder: path.posix.basename(relPosix),
                itemPath: abs
            });
            return;
        }
        for (const e of list.sort()) {
            if (e.startsWith('.') || RESERVED.includes(e)) continue;
            const st = await fs.stat(path.join(abs, e));
            if (st.isDirectory()) await visit(rel ? path.join(rel, e) : e);
        }
    };
    await visit('');
    return items;
}

function publicPrefix(category, folder) {
    // 对外统一 /content/<相对路径>/<id>，category 为空则去掉多余段
    return category ? `/content/${category}/${folder}` : `/content/${folder}`;
}

async function processItem(item) {
    const { category, folder, itemPath } = item;
    try {
        const stats = await fs.stat(itemPath);
        if (!stats.isDirectory()) return null;

        const files = await fs.readdir(itemPath);

        // 查找预览图
        const sourceImg = files.find(f =>
            SUPPORTED_IMG_EXTS.includes(path.extname(f).toLowerCase()) &&
            f.toLowerCase().startsWith('preview')
        );

        let finalPreview = sourceImg ? `${publicPrefix(category, folder)}/${sourceImg}` : '';

        if (sourceImg) {
            const webpPath = path.join(itemPath, 'preview.webp');

            try {
                // 预览图以子模块内置的 preview.webp 为准，缺失时本地兜底转换
                await fs.access(webpPath);
                finalPreview = `${publicPrefix(category, folder)}/preview.webp`;
            } catch {
                const key = category + '/' + folder;
                if (!SOURCE_CONVERSION_WARNED.has(key)) {
                    SOURCE_CONVERSION_WARNED.add(key);
                    console.warn(`提示: ${key} 缺少 preview.webp，本地生成`);
                }
                try {
                    await sharp(path.join(itemPath, sourceImg))
                        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
                        .webp({ quality: 80, effort: 2 })
                        .toFile(webpPath);
                    finalPreview = `${publicPrefix(category, folder)}/preview.webp`;
                } catch (err) {
                    console.warn(`图片转换失败 ${key}: ${err.message}`);
                }
            }
        }

        // 查找存档文件
        const archiveFile = files.find(f =>
            ['.litematic', '.zip', '.rar'].some(ext => f.toLowerCase().endsWith(ext))
        );

        // 读取元数据
        const info = JSON.parse(await fs.readFile(path.join(itemPath, 'info.json'), 'utf-8'));

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

async function build() {
    console.log(`正在构建稿件数据库（来源: content/ 子模块）...`);
    console.time('构建耗时');

    try {
        const items = await collectItems();
        // 并发处理所有稿件
        const results = await Promise.all(items.map(processItem));
        const database = results.filter(item => item !== null);

        const dataDir = path.dirname(OUTPUT_FILE);
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(database, null, 4));

        // 根级 index.html 与 pages/home 保持同步（Vercel cleanUrls 下根 rewrite 不生效，
        // 需物理文件承接 "/" 访问）
        await fs.copyFile(
            path.join(root, 'pages/home/index.html'),
            path.join(root, 'index.html')
        );

        console.log(`\n构建成功！共发现 ${database.length} 个稿件。`);
        console.timeEnd('构建耗时');

    } catch (err) {
        console.error('错误:', err.message);
        process.exit(1);
    }
}

build();
