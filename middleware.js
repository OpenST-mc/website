import { NextResponse } from 'next/server';

export async function middleware(req) {
    const url = new URL(req.url);

    // 1. 【防死循环】如果是文件请求，直接滚开，不许进逻辑
    if (url.pathname.includes('.') || url.pathname.startsWith('/data/')) {
        return NextResponse.next();
    }

    const ua = req.headers.get('user-agent') || '';
    const isBot = /discordbot|twitterbot|facebookexternalhit|whatsapp|googlebot|telegrambot/i.test(ua);
    const subId = Array.from(url.searchParams.keys()).find(k => k.startsWith('sub-'));

    if (isBot && subId) {
        try {
            const dbRes = await fetch(`${url.origin}/data/database.json`);
            if (!dbRes.ok) return NextResponse.next();
            const database = await dbRes.json();
            const item = database.find(i => i.sub_id === subId);

            if (item) {
                // 【暴力破解加号】直接拼 GitHub Raw 链接，这是最稳的
                const safePath = item.preview.split('/').map(s => encodeURIComponent(decodeURIComponent(s))).join('/');
                const absoluteImageUrl = `https://raw.githubusercontent.com/MC-OpenST/website/main/${safePath}`;

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
        } catch (e) { return NextResponse.next(); }
    }
    return NextResponse.next();
}

export const config = { matcher: ['/', '/archive.html', '/archive/'] };