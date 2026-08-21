// auth.js
// 管理认证状态（token 仅存于 HttpOnly Cookie，本地只缓存非敏感资料）
export const PortalAuth = {
    // 缓存非敏感会话信息，绝不含 token
    async save(user, isAdmin = false) {
        const authData = {
            user: user,
            isAdmin: isAdmin,
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

    // 向后端查询会话（后端读取 HttpOnly Cookie 校验），返回 { user, isAdmin }
    async fetchSession(WORKER_URL) {
        try {
            const res = await fetch(`${WORKER_URL}/api/session`, { credentials: 'include' });
            if (!res.ok) return null;
            const data = await res.json();
            if (!data.user) {
                PortalAuth.clear();
                return null;
            }
            await PortalAuth.save(data.user, data.isAdmin);
            return data;
        } catch (e) {
            console.error("Session fetch failed", e);
            return null;
        }
    },

    // 退出登录：通知后端清除 Cookie 并清理本地缓存
    async logout(WORKER_URL) {
        try {
            await fetch(`${WORKER_URL}/api/logout`, { method: 'POST', credentials: 'include' });
        } catch (e) {
            console.error("Logout failed", e);
        }
        PortalAuth.clear();
    },

    clear() {
        localStorage.removeItem('gh_auth');
    }
};
