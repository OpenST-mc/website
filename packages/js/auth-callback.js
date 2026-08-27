// 登录回调：兑换 OAuth code 后仅允许跳回站内路径
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state'); // 这里存的是当初点击登录的页面地址

// 解析 state，仅允许站内相对路径，防止开放重定向
function resolveRedirect() {
    if (!state) return '/archive/index.html';
    try {
        const decoded = atob(state);
        if (decoded.startsWith('/') && !decoded.startsWith('//')) return decoded;
        if (decoded.startsWith('./') || decoded.startsWith('../')) return decoded;
    } catch (e) {
        // 解码失败则回退默认地址
    }
    return '/archive/index.html';
}

if (code) {
    // 1. 去 Worker 换 Token（token 仅写入 HttpOnly Cookie，不落 localStorage）
    fetch(`https://api.openstmc.com/api/exchange-token?code=${code}`, { credentials: 'include' })
        .then(() => {
            window.location.href = resolveRedirect();
        })
        .catch(() => {
            window.location.href = resolveRedirect();
        });
} else {
    window.location.href = '/archive/index.html';
}
