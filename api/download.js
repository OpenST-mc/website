// 下载计数 + 302 跳转
// GET /api/download?id=<sub_id 或稿件文件夹名>
// 依赖 Upstash Redis（UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN）；
// 未配置时仅跳转不计数
import { Redis } from '@upstash/redis';
import crypto from 'node:crypto';

const DB_URL = 'https://openstmc.com/archive/data/database.json';
const RAW_BASE = 'https://raw.githubusercontent.com/OpenST-mc/website/main';
const PROXY_BASE = 'https://cdn.openstmc.com/https:/raw.githubusercontent.com/OpenST-mc/website/main';

let redisClient = null;

// 懒加载 Redis 客户端，环境变量缺失时返回 null
function getRedis() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;
    if (!redisClient) {
        redisClient = new Redis({ url, token });
    }
    return redisClient;
}

function badRequest(res, message) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: message }));
}

// 稿件 ID 校验：仅允许安全字符，防止路径/键注入
function sanitizeId(id) {
    return typeof id === 'string' && id.length > 0 && id.length <= 200 &&
        !/[\\/]/.test(id) && !/[\u0000-\u001f]/.test(id) ? id : null;
}

export default async function handler(req, res) {
    const rawId = req.query.id;
    const id = sanitizeId(rawId);
    if (!id) return badRequest(res, 'Invalid id');

    let database;
    try {
        database = await fetch(DB_URL).then(r => r.json());
    } catch (e) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ error: 'Database unavailable' }));
    }

    const item = database.find(i => i.sub_id === id || i.id === id);
    if (!item || !item.filename) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ error: 'Archive not found' }));
    }

    const safeFolder = String(item.id).split('/').map(encodeURIComponent).join('/');
    const safeFile = String(item.filename).split('/').map(encodeURIComponent).join('/');
    const target = `${PROXY_BASE}/archive/archive/${safeFolder}/${safeFile}`;
    const rawTarget = `${RAW_BASE}/archive/archive/${safeFolder}/${safeFile}`;

    // 计数（Redis 未配置时静默跳过，不影响下载）
    const redis = getRedis();
    if (redis) {
        try {
            const counterKey = `dl:${String(item.sub_id || item.id).replace(/[^a-zA-Z0-9\-_.]/g, '_')}`;
            const forwarded = req.headers['x-forwarded-for'] || '';
            const ip = String(forwarded).split(',')[0].trim() || 'unknown';
            const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 24);

            // 同一 IP 24 小时内对同一稿件只计一次
            const dedupKey = `dl:ip:${counterKey}:${ipHash}`;
            const fresh = await redis.set(dedupKey, '1', { nx: true, ex: 86400 });
            if (fresh) {
                await redis.incr(counterKey);
                await redis.incr('dl:total');
            }
        } catch (e) {
            console.error('Redis 计数失败:', e.message);
        }
    }

    // 目标地址可选 ?raw=1 走 GitHub 直链（前端默认走 CDN 代理）
    res.statusCode = 302;
    res.setHeader('Location', req.query.raw ? rawTarget : target);
    res.setHeader('Cache-Control', 'no-store');
    res.end();
}
