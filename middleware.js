// middleware.js
import { NextResponse } from 'next/server';

export async function middleware(req) {
    const url = new URL(req.url);
    const subId = url.search.replace('?', '');
    const ua = req.headers.get('user-agent') || '';

    // 1. 爬虫识别逻辑
    const isBot = /discordbot|twitterbot|facebookexternalhit|whatsapp|googlebot/i.test(ua);

    // 如果是分享链接且是爬虫访问
    if (isBot && subId.startsWith('sub-')) {
        try {
            // 2. 获取数据库（直接 fetch 你 Vercel 上的静态文件）
            const res = await fetch(`${url.origin}/data/database.json`);
            const database = await res.json();

            // 3. 精准匹配稿件
            const item = database.find(i => i.sub_id === subId);

            if (item) {
                // 4. 路径处理：必须是绝对路径且编码中文
                const domain = url.origin;
                const safePreviewPath = item.preview.split('/')
                    .map(s => encodeURIComponent(s))
                    .join('/');
                const absoluteImageUrl = `${domain}/${safePreviewPath}`;

                // 5. 组装并返回 Meta HTML
                return new Response(
                    `<!DOCTYPE html>
                    <html>
                        <head>
                            <meta charset="utf-8">
                            <title>${item.name}</title>
                            <meta property="og:title" content="${item.name}">
                            <meta property="og:author" content="${item.author}">
                            <meta property="og:description" content="作者: ${item.author} | 标签: ${item.tags.join(', ')}">
                            <meta property="og:image" content="${absoluteImageUrl}">
                            <meta property="og:type" content="article">
                            <meta name="twitter:card" content="summary_large_image">
                            <meta http-equiv="refresh" content="0;url=${url.href}">
                        </head>
                        <body>Redirecting to OpenST Archive...</body>
                    </html>`,
                    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                );
            }
        } catch (e) {
            console.error('Middleware metadata injection failed:', e);
        }
    }

    return NextResponse.next();
}