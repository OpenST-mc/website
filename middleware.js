// middleware.js
import { NextResponse } from 'next/server';

export async function middleware(req) {
    const url = new URL(req.url);

    // 【硬核逻辑 1】切断递归：如果是静态资源请求，滚去直接加载，别进中间件
    if (url.pathname.includes('.') || url.pathname.startsWith('/data/')) {
        return NextResponse.next();
    }

    const ua = req.headers.get('user-agent') || '';
    const isBot = /discordbot|twitterbot|facebookexternalhit|whatsapp|googlebot|telegrambot/i.test(ua);

    // 提取 subId
    const subId = Array.from(url.searchParams.keys()).find(k => k.startsWith('sub-'));

    if (isBot && subId) {
        try {
            // 【硬核逻辑 2】直接 fetch 物理路径，不要带域名，防止跨域解析问题
            const dbRes = await fetch(`${url.origin}/data/database.json`);
            if (!dbRes.ok) return NextResponse.next();

            const database = await dbRes.json();
            const item = database.find(i => i.sub_id === subId);

            if (item) {
                // 【硬核逻辑 3】针对加号的终极处理
                // 如果转义成了 %2B 还不行，说明服务器要的是“未编码”的原始路径或双重转义
                // 这里我们给爬虫返回最稳的地址：CDN 代理
                const safePath = item.preview.replace(/\+/g, '%2B');
                const absoluteImageUrl = `https://cdn.linvin.net/https://raw.githubusercontent.com/MC-OpenST/website/main/${safePath}`;

                return new Response(
                    `<!DOCTYPE html><html><head><meta charset="utf-8">
                    <title>${item.name}</title>
                    <meta property="og:title" content="${item.name}">
                    <meta property="og:image" content="${absoluteImageUrl}">
                    <meta property="twitter:card" content="summary_large_image">
                    <meta http-equiv="refresh" content="0;url=${url.href}">
                    </head><body>Redirecting...</body></html>`,
                    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                );
            }
        } catch (e) {
            return NextResponse.next();
        }
    }

    return NextResponse.next();
}

export const config = {
    // 别管那些复杂的正则了，直接只拦截根路径和 archive 相关页面
    matcher: ['/', '/archive.html', '/archive/'],
};