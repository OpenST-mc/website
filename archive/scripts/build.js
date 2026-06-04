import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const ARCHIVE_DIR = path.join(root, 'archive');
const OUTPUT_FILE = path.join(root, 'data/database.json');

// 支持的原始图片格式优先顺序
const SUPPORTED_IMG_EXTS = ['.png', '.jpg', '.jpeg','.webp',];

async function processFolder(folder) {
    if (folder.startsWith('.')) return null;

    const folderPath = path.join(ARCHIVE_DIR, folder);
    try {
        const stats = await fs.stat(folderPath);
        if (!stats.isDirectory()) return null;

        const files = await fs.readdir(folderPath);

        // 查找预览图
        const sourceImg = files.find(f =>
            SUPPORTED_IMG_EXTS.includes(path.extname(f).toLowerCase()) &&
            f.toLowerCase().startsWith('preview')
        );

        let finalPreview = sourceImg ? `archive/${folder}/${sourceImg}` : '';

        if (sourceImg) {
            const sourcePath = path.join(folderPath, sourceImg);
            const webpPath = path.join(folderPath, 'preview.webp');

            try {
                const sourceStats = await fs.stat(sourcePath);
                let shouldConvert = false;

                try {
                    const webpStats = await fs.stat(webpPath);
                    // 增量检查：原图比 WebP 新才重转
                    if (sourceStats.mtime > webpStats.mtime) shouldConvert = true;
                } catch {
                    shouldConvert = true;
                }

                if (shouldConvert) {
                    await sharp(sourcePath)
                        .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
                        .webp({ quality: 80, effort: 2 }) // effort 2 保证转换速度
                        .toFile(webpPath);
                    console.log(`优化图片: ${folder}/${sourceImg} -> WebP`);
                }
                finalPreview = `/archive/${folder}/preview.webp`;
            } catch (err) {
                console.warn(` 图片转换失败 ${folder}: ${err.message}`);
            }
        }

        // 查找存档文件
        const archiveFile = files.find(f =>
            ['.litematic', '.zip', '.rar'].some(ext => f.toLowerCase().endsWith(ext))
        );

        // 读取元数据
        const infoPath = path.join(folderPath, 'info.json');
        const info = JSON.parse(await fs.readFile(infoPath, 'utf-8'));

        console.log(`已处理: ${info.name || folder}`);

        return {
            id: folder,
            name: info.name || folder,
            author: info.author || 'Unknown',
            tags: info.tags || [],
            description: info.description || '',
            preview: finalPreview,
            filename: archiveFile || '',
            sub_id: info.id || ''
        };
    } catch (e) {
        console.warn(`跳过目录 "${folder}": ${e.message}`);
        return null;
    }
}

async function build() {
    console.log(`正在构建...`);
    console.time('构建耗时');

    try {
        await fs.access(ARCHIVE_DIR);
        const folders = await fs.readdir(ARCHIVE_DIR);

        // 并发处理所有文件夹，大幅提升处理多图片时的速度
        const results = await Promise.all(folders.map(folder => processFolder(folder)));

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