// wiki/wiki-core.js
import { PortalAuth } from '../scripts/auth.js';

const CONFIG = {
    WORKER: "https://openstsubmission.linvin.net",
    CLIENT_ID: 'Ov23liTildfj3XAkvbr8',
    ORG_NAME: 'MC-OpenST'
};

Vue.createApp({
    data() {
        return {
            user: null,
            step: 1
        }
    },
    template: `
      <teleport to="body">
        <header class="top-bar">
          <div class="bar-content">
            <div class="user-zone">
              <div v-if="user" class="status-indicator">
                <div class="user-info">
                  <span class="username">{{ user.login }}</span>
                  <span v-if="user.isStaff" class="badge">Staff</span>
                </div>
                <img :src="user.avatar" class="user-avatar-frame">
                <button @click="logout" class="logout-btn">EXIT</button>
              </div>
              <button v-else @click="loginWithGitHub" :disabled="step === 2" class="github-login-btn">
                {{ step === 2 ? 'IDENTIFYING...' : 'GitHub 登录' }}
              </button>
            </div>
          </div>
        </header>

        <div v-if="user" class="fab-group">
          <div class="fab-item" @click="goToEdit('modify')">
            <span class="fab-label">修改文章</span>
            <div class="fab-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </div>
          <div class="fab-item primary" @click="goToEdit('new')">
            <span class="fab-label">创建新文章</span>
            <div class="fab-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 4v16m8-8H4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </div>
        </div>
      </teleport>
`,
    async mounted() {
        this.checkLogin();
        const code = new URLSearchParams(window.location.search).get('code');
        if (code && this.step !== 2) await this.handleOAuth(code);
    },
    methods: {
        loginWithGitHub() {
            const redirect_uri = window.location.origin + window.location.pathname;
            const state = btoa(window.location.href);
            window.location.href = `https://github.com/login/oauth/authorize?client_id=${CONFIG.CLIENT_ID}&scope=read:org,repo&state=${state}&redirect_uri=${encodeURIComponent(redirect_uri)}`;
        },
        async handleOAuth(code) {
            this.step = 2;
            const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
            try {
                const res = await fetch(`${CONFIG.WORKER}/api/exchange-token?code=${code}`);
                const data = await res.json();
                if (data.access_token) {
                    const userRes = await fetch('https://api.github.com/user', { headers: { Authorization: `token ${data.access_token}` } });
                    const userData = await userRes.json();
                    const orgRes = await fetch(`https://api.github.com/orgs/${CONFIG.ORG_NAME}/members/${userData.login}`, { headers: { Authorization: `token ${data.access_token}` } });

                    const isStaff = orgRes.status === 204;
                    await PortalAuth.save({
                        access_token: data.access_token,
                        user: { login: userData.login, avatar: userData.avatar_url, isStaff: isStaff }
                    });
                    this.checkLogin();
                }
            } catch (e) { console.error(e); } finally { this.step = 1; }
        },
        checkLogin() {
            const auth = PortalAuth.get();
            if (auth) this.user = auth.user;
        },
        logout() { PortalAuth.logout(); },
        goToEdit(type) {
            const currentPath = window.location.hash.replace(/^#/, '').split('?')[0] || '/README';
            const targetPath = type === 'new' ? '/NEW_DOCUMENT' : currentPath;
            window.location.href = `wiki_edit.html?path=${encodeURIComponent(targetPath)}`;
        }
    }
}).mount('#wiki-collab');

document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.search input').focus();
    }
});

(function() {
    // 1. 初始化：优先从本地读取，没有则默认 16
    let currentSize = parseInt(localStorage.getItem('openst_fs')) || 16;

    // 2. 核心调节函数：负责计算、存储、修改 CSS 变量和更新 UI
    window.adjustFS = function(delta) {
        currentSize = Math.max(12, Math.min(32, currentSize + delta));

        // 修改根元素变量，CSS 会自动响应
        document.documentElement.style.setProperty('--wiki-fs', currentSize + 'px');
        localStorage.setItem('openst_fs', currentSize);

        // 同步更新面板上的数字
        const display = document.getElementById('current-fs-display');
        if (display) display.innerText = currentSize;
    };

    // 3. 注入控制面板的 UI 函数
    function injectCtrl() {
        const target = document.querySelector('.markdown-section');
        // 防止重复注入
        if (!target || document.getElementById('fs-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'fs-panel';
        panel.className = 'font-ctrl-panel';
        panel.innerHTML = `
            <span class="font-ctrl-tag" style="font-size:9px; font-weight:900; color:rgba(255,255,255,0.2); letter-spacing:0.2em; text-transform:uppercase;">Scale</span>
            <div class="font-ctrl-group">
                <div class="font-ctrl-btn" onclick="adjustFS(-1)">−</div>
                <div class="font-ctrl-val" id="current-fs-display">${currentSize}</div>
                <div class="font-ctrl-btn" onclick="adjustFS(1)">+</div>
            </div>
        `;

        // 插入到文章内容的最前面
        target.insertBefore(panel, target.firstChild);
    }

    // 4. Docsify 插件集成
    window.$docsify = window.$docsify || {};
    window.$docsify.plugins = [].concat(window.$docsify.plugins || [], function(hook) {
        hook.doneEach(function() {
            // 每次页面渲染完：注入面板 + 应用当前字号
            injectCtrl();
            document.documentElement.style.setProperty('--wiki-fs', currentSize + 'px');
        });
    });
})();

window.$docsify.plugins = [].concat(function(hook) {
    hook.afterEach(function(html) {
        // 将 ||内容|| 转换为黑幕 HTML
        return html.replace(/\|\|(.*?)\|\|/g, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');
    });
}, window.$docsify.plugins);