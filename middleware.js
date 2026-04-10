import { next } from '@vercel/edge';

export default function middleware(req) {
    const url = new URL(req.nextUrl);
    const ua = req.headers.get('user-agent') || '';

    // 匹配你的 sub-xxx 链接
    const subId = url.search.replace('?', '');

    // 这里的正则涵盖了主流社交平台和搜索引擎的爬虫身份
    const isBot = /googlebot|bingbot|discordbot|twitterbot|facebookexternalhit|baiduspider/i.test(ua);

    // 如果是爬虫且在看稿件，强行把它转给 API 渲染器
    if (isBot && subId.startsWith('sub-')) {
        // 重写 URL 到 API，但浏览器地址栏不会变
        url.pathname = '/api/DymaticMeta';
        return Response.rewrite(url);
    }

    return next();
}