// middleware.js
export async function middleware(req) {
    const url = new URL(req.url);
    const ua = req.headers.get('user-agent') || '';

    // 1. 提取 subId (兼容 ?sub-xxx 和 ?id=sub-xxx)
    let subId = null;
    for (const key of url.searchParams.keys()) {
        if (key.startsWith('sub-')) {
            subId = key;
            break;
        }
    }

    const isBot = /discordbot|twitterbot|facebookexternalhit|whatsapp|googlebot|telegrambot/i.test(ua);

    if (isBot && subId) {
        try {
            // 获取数据库
            const dbRes = await fetch(`${url.origin}/data/database.json`);
            if (!dbRes.ok) return;

            const database = await dbRes.json();
            const item = database.find(i => i.sub_id === subId);

            if (item) {
                const domain = url.origin;

                // 【优化 A】处理中文路径，确保图片在大牛的 Discord 里秒开
                const safePreviewPath = item.preview.split('/')
                    .map(segment => encodeURIComponent(segment))
                    .join('/');
                const absoluteImageUrl = `${domain}/${safePreviewPath}`;

                // 【优化 B】净化描述文本，去掉 Markdown 符号，只留纯文字
                const cleanDesc = item.description
                    .replace(/[#*>`-]/g, '') // 去掉 Markdown 符号
                    .replace(/\n+/g, ' ')    // 把换行变空格
                    .substring(0, 160);      // 截取前 160 字

                const displayTags = item.tags.join(' · ');

                return new Response(
                    `<!DOCTYPE html>
                    <html lang="zh-CN">
                        <head>
                            <meta charset="utf-8">
                            <title>${item.name}</title>
                            <meta name="description" content="${cleanDesc}">
                            
                            <meta property="og:type" content="article">
                            <meta property="og:title" content="${item.name}">
                            <meta property="og:description" content="👤 作者: ${item.author} | 🏷️ 标签: ${displayTags}\n\n${cleanDesc}">
                            <meta property="og:image" content="${absoluteImageUrl}">
                            <meta property="og:url" content="${url.href}">
                            
                            <meta name="twitter:card" content="summary_large_image">
                            <meta name="twitter:title" content="${item.name}">
                            <meta name="twitter:image" content="${absoluteImageUrl}">

                            <meta http-equiv="refresh" content="0;url=${url.href}">
                        </head>
                        <body>Redirecting to OpenST Archive...</body>
                    </html>`,
                    {
                        headers: {
                            'Content-Type': 'text/html; charset=utf-8',
                            'Cache-Control': 'public, max-age=600' // 缓存 10 分钟
                        }
                    }
                );
            }
        } catch (e) {
            console.error('OpenST Middleware Error:', e);
        }
    }
    return;
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};