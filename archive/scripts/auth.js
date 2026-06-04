// auth.js
// 管理认证状态
export const PortalAuth = {
    // 升级 save 为异步函数，确保全站任何地方调用都能存入完整信息
    async save(data, fetchFromGitHub = false) {
        let user = data.user || {};

        // 如果是从档案馆那种只有 token 的地方调用，或者强制要求更新
        if (fetchFromGitHub && data.access_token) {
            try {
                const res = await fetch('https://api.github.com/user', {
                    headers: { Authorization: `token ${data.access_token}` }
                });
                const userData = await res.json();
                user = {
                    login: userData.login,
                    avatar: userData.avatar_url,
                    avatar_url: userData.avatar_url
                };
            } catch (e) { console.error("Fetch user failed", e); }
        }

        const authData = {
            token: data.access_token,
            user: user,
            isAdmin: data.isAdmin || user.isStaff || false,
            timestamp: Date.now()
        };
        localStorage.setItem('gh_auth', JSON.stringify(authData));
    },

    get() {
        const raw = localStorage.getItem('gh_auth');
        if (!raw) return null;
        try {
            const data = JSON.parse(raw);
            // 7天过期逻辑
            if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
                localStorage.removeItem('gh_auth');
                return null;
            }
            return data;
        } catch (e) {
            console.error("Parse auth data failed", e);
            return null;
        }
    },

    logout() {
        localStorage.removeItem('gh_auth');
        window.location.reload();
    }
};