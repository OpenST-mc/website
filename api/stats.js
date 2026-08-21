// 查询单稿件下载量
// GET /api/stats?id=<sub_id 或稿件文件夹名>
// Redis 未配置时返回 count: null（前端隐藏计数显示）
import { Redis } from '@upstash/redis';

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

export default async function handler(req, res) {
    const rawId = req.query.id;
    const id = typeof rawId === 'string' && rawId.length > 0 && rawId.length <= 200 &&
        !/[\\/]/.test(rawId) && !/[\u0000-\u001f]/.test(rawId) ? rawId : null;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');

    if (!id) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid id' }));
    }

    const redis = getRedis();
    if (!redis) {
        return res.end(JSON.stringify({ id, count: null }));
    }

    try {
        const counterKey = `dl:${id.replace(/[^a-zA-Z0-9\-_.]/g, '_')}`;
        const value = await redis.get(counterKey);
        return res.end(JSON.stringify({ id, count: value == null ? 0 : Number(value) }));
    } catch (e) {
        console.error('Redis 查询失败:', e.message);
        return res.end(JSON.stringify({ id, count: null }));
    }
}
