export default function middleware(req) {
    const url = new URL(req.url);
    const ua = req.headers.get('user-agent') || '';
    const subId = url.search.replace('?', '');
    const isBot = /googlebot|bingbot|discordbot|twitterbot|facebookexternalhit|baiduspider/i.test(ua);
    if (isBot && subId.startsWith('sub-')) {
        const rewriteUrl = new URL('/api/DymaticMeta', req.url);
        rewriteUrl.search = url.search;
        return Response.rewrite(rewriteUrl);
    }
}
export const config = {
    matcher: '/archive',
};