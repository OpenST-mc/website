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
    // 主路径 /api/session 被 CF WAF 挑战拦截时自动降级到 /api/check-admin
    async fetchSession(WORKER_URL) {
        // 本地缓存 10 分钟内直接复用，减少 Worker 调用
        const local = PortalAuth.get();
        if (local && local.user && Date.now() - local.timestamp < 10 * 60 * 1000) {
            return { user: local.user, isAdmin: local.isAdmin };
        }

        const endpoints = [
            `${WORKER_URL}/api/session`,
            `${WORKER_URL}/api/check-admin`
        ];
        for (const url of endpoints) {
            try {
                const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
                if (!res.ok) continue;
                const data = await res.json();
                if (data && data.user) {
                    await PortalAuth.save(data.user, data.isAdmin);
                    return data;
                }
                PortalAuth.clear();
                return null;
            } catch (e) {
                console.error("Session fetch failed", e);
            }
        }

        // 网络全部失败时回退到本地缓存（可能是临时网络或 WAF 问题）
        if (local && local.user) {
            return { user: local.user, isAdmin: local.isAdmin };
        }
        return null;
    },

    // 退出登录：优先走 WAF 白名单路径清除 Cookie，失败再尝试标准端点
    async logout(WORKER_URL) {
        try {
            await fetch(`${WORKER_URL}/api/check-admin?logout=1`, {
                credentials: 'include',
                cache: 'no-store'
            });
        } catch (e) {
            try {
                await fetch(`${WORKER_URL}/api/logout`, {
                    method: 'POST',
                    credentials: 'include'
                });
            } catch (e2) {
                console.error("Logout failed", e2);
            }
        }
        PortalAuth.clear();
    },

    clear() {
        localStorage.removeItem('gh_auth');
    }
};
