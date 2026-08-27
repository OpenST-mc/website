import * as Logic from './logic.js';
import * as UI from './ui.js';
import { TAG_CONFIG, CATEGORIES } from './config.js';
import { PortalAuth } from '/auth/auth.js';

const { createApp } = Vue;
const WORKER_URL = 'https://api.openstmc.com';

console.log(
    "%c如果你并非网页开发人员，请勿在控制台内输入任何人传给你的脚本！\n%c在控制台输入脚本可能会让攻击者盗取你的 GitHub 访问令牌（Token），从而控制你的仓库或篡改数据。",
    "color: #333; font-size: 16px; font-weight: bold;",
    "color: red; font-size: 14px;"
);

// 懒加载指令
const lazyDirective = {
    mounted(el, binding) {
        el.dataset.src = binding.value;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && el.dataset.src) {
                    el.src = el.dataset.src;
                    el.style.opacity = "1";
                    el.decoding = "async";
                } else if (!entry.isIntersecting && el.src && el.src !== window.location.href) {
                    el.dataset.src = el.src;
                    el.src = "";
                    el.style.opacity = "0";
                }
            });
        }, { rootMargin: '300px', threshold: 0 });
        observer.observe(el);
        el._observer = observer;
    },
    updated(el, binding) {
        if (binding.value !== binding.oldValue) {
            el.dataset.src = binding.value;
            if (el.src) el.src = binding.value;
        }
    },
    unmounted(el) { el._observer?.disconnect(); }
};

// App 主逻辑
const AppOptions = {
    components: {
        'nav-bar': UI.NavBar,
        'side-bar': UI.SideBar,
        'archive-card': UI.ArchiveCard,
        'detail-modal': UI.DetailModal
    },
    data() {
        const initialSelected = {};
        CATEGORIES.forEach(cat => { initialSelected[cat] = []; });

        return {
            user: null,
            isAdmin: false,
            allData: [],
            dictSArray: [],
            dictTArray: [],
            searchQuery: '',
            TAG_CONFIG,
            categories: CATEGORIES,
            selectedTags: initialSelected,
            detailItem: null,
            useProxy: true,
            zoomImage: null,
            currentPage: 1,
            pageSize: 7,
            favorites: JSON.parse(localStorage.getItem('openst_favs') || '[]'),
            showOnlyFavs: false,
        }
    },
    computed: {
        normalizedSearch() { return this.normalize(this.searchQuery); },
        fullFilteredList() {
            let list = Logic.getFilteredList(
                this.allData,
                this.searchQuery,
                this.selectedTags,
                this.normalize
            );
            if (this.showOnlyFavs) {
                list = list.filter(item => this.favorites.includes(item.id));
            }

            return list;
        },
        totalPages() { return Math.ceil(this.fullFilteredList.length / this.pageSize) || 1; },
        pagedList() {
            const start = (this.currentPage - 1) * this.pageSize;
            return this.fullFilteredList.slice(start, start + this.pageSize);
        },
        dynamicTagGroups() {
            return Logic.calculateDynamicTags(this.allData, this.categories, this.selectedTags);
        }
    },
    watch: {
        selectedTags: { deep: true, handler() { this.currentPage = 1; } },
        searchQuery() { this.currentPage = 1; },
        showOnlyFavs() { this.currentPage = 1; }
    },
    methods: {
        // URL 参数定位逻辑 (?sub-xxx)
        checkUrlLocation() {
            const queryString = window.location.search.replace('?', '');
            if (queryString && queryString.startsWith('sub-')) {
                const target = this.allData.find(item => item.sub_id === queryString);
                if (target) {
                    this.detailItem = target;
                }
            }
        },
        resetFilters() {
            // 1. 清空搜索内容
            this.searchQuery = '';

            // 2. 将所有分类的已选标签数组重置为空
            this.categories.forEach(cat => {
                this.selectedTags[cat] = [];
                this.showOnlyFavs = false;
            });

            // 3. 回归第一页并同步 URL 状态
            this.currentPage = 1;
            if (window.location.search) {
                window.history.replaceState(null, '', window.location.pathname);
            }

            // 4. (可选) 如果侧边栏有引用，也可以在重置后自动收起
            if (this.$refs.sidebar) {
                this.$refs.sidebar.isOpen = false;
            }
        },

        // 繁简转换逻辑
        normalize(str) {
            if (!str) return '';
            const inputChars = Array.from(str.toLowerCase().trim());
            if (this.dictSArray.length === 0) return str.toLowerCase().trim();
            return inputChars.map(char => {
                const idx = this.dictTArray.indexOf(char);
                return (idx > -1) ? this.dictSArray[idx] : char;
            }).join('');
        },

        // 路径安全转义 (处理中文/空格文件夹)
        getSafePath(path) {
            if (!path) return '';
            return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
        },

        // 下载链接生成（稿件数据在 OpenST-mc/archive 仓库 content/<分类>/<id>/）
        getDownloadLink(item) {
            if (!item) return '';
            const path = `content/${item.category}/${item.id}/${item.filename}`;
            const raw = `https://raw.githubusercontent.com/OpenST-mc/archive/main/${path}`;
            const finalRaw = raw.replace('https://', 'https:/');
            return this.useProxy ? `https://cdn.openstmc.com/${finalRaw}` : raw;
        },

        // 编辑跳转逻辑
        openEdit(item) {
            if (!item || !item.id) return;
            const folder = encodeURIComponent(item.id.trim());
            window.location.href = `../../admin_tools/admin_edit.html?folder=${folder}`;
        },

        // 详情页控制
        openDetail(item) {
            this.detailItem = item;
            if (item && item.sub_id) {
                const newUrl = `${window.location.pathname}?${item.sub_id}`;
                window.history.pushState({ subId: item.sub_id }, '', newUrl);
                if (item.name) {
                    document.title = `${item.name} - OpenST Archive`;
                }
            }
        },

        // 详情页关闭：还原 URL
        closeDetail() {
            this.detailItem = null;
            // 彻底移除查询参数，恢复到 example.com/index.html
            window.history.pushState({}, '', window.location.pathname);
            document.title = "OpenST Archive";
        },

        handleCopyID(subId) {
            console.log("Archive ID copied:", subId);
        },

        // 身份验证逻辑
        async handleLogin() {
            const CLIENT_ID = 'Ov23liTildfj3XAkvbr8';
            const redirect_uri = window.location.origin + window.location.pathname;
            // 生成一次性 state，防止登录 CSRF
            const state = crypto.randomUUID();
            sessionStorage.setItem('oauth_state', state);
            window.location.href = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=public_repo&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${state}`;
        },
        async checkIdentity() {
            const session = await PortalAuth.fetchSession(WORKER_URL);
            if (session) {
                this.user = session.user;
                this.isAdmin = session.isAdmin;
            }
        },
        async handleLogout() {
            this.user = null;
            this.isAdmin = false;
            await PortalAuth.logout(WORKER_URL);
            window.location.reload();
        },

        // UI 交互方法
        toggleTag(cat, tag) {
            const list = this.selectedTags[cat];
            const index = list.indexOf(tag);
            if (index > -1) list.splice(index, 1);
            else list.push(tag);
        },
        setPage(p) {
            const pageIdx = parseInt(p);
            if (!isNaN(pageIdx) && pageIdx >= 1 && pageIdx <= this.totalPages) {
                this.currentPage = pageIdx;
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        },
        handleImageZoom(e) {
            const target = e.target || e;
            if (target.tagName !== 'IMG') return;
            this.zoomImage = { url: target.src, name: "Preview" };
            document.body.style.overflow = 'hidden';
        },
        closeZoom() { this.zoomImage = null; document.body.style.overflow = ''; },
        get3DPreviewLink(item) {
            if (!item) return '';
            const fileUrl = this.getDownloadLink(item);
            const viewerPath = 'Extra-Function/litematic-preview/index.html';

            return `${viewerPath}#${fileUrl}`;
        },

        open3DPreview(item) {
            const url = this.get3DPreviewLink(item);
            if (url) {
                window.open(url, '_blank');
            }
        },
        toggleFavorite(itemId) {
            const index = this.favorites.indexOf(itemId);
            if (index > -1) {
                this.favorites.splice(index, 1);
            } else {
                this.favorites.push(itemId);
            }
            // 持久化到本地存储
            localStorage.setItem('openst_favs', JSON.stringify(this.favorites));
        },

        isFavorite(itemId) {
            return this.favorites.includes(itemId);
        },

        // 加载数据库与繁简字典（独立于身份校验，可并行）
        async loadData() {
            try {
                const [dataRes, dictRes] = await Promise.all([
                    fetch('archive/data/database.json'),
                    fetch('./Traditional-Simplefild/STCharacters.txt')
                ]);

                // 解析字典
                const dictText = await dictRes.text();

                const fs = [];
                const ft = [];

                dictText.split(/\r?\n/).forEach(line => {
                    if (!line || line.startsWith('#')) return;
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 2) {
                        parts.slice(1).forEach(t => {
                            fs.push(parts[0]);
                            ft.push(t);
                        });
                    }
                });

                this.dictSArray = Object.freeze(fs);
                this.dictTArray = Object.freeze(ft);

                // 装载数据库 (这行没跑通，投影就不会出来)
                const rawData = await dataRes.json();
                this.allData = Object.freeze(rawData);

                // 数据加载完后再执行 URL 定位
                this.checkUrlLocation();
                if (this.detailItem) {
                    document.title = `${this.detailItem.name} - OpenST 档案馆`;
                }

            } catch (e) {
                console.error("Data Load Error: 检查文件路径是否正确", e);
            }
        }
    },

    async mounted() {
        // 1. 优先处理登录回调
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
            // 校验 OAuth state，防止登录 CSRF
            const state = urlParams.get('state');
            const savedState = sessionStorage.getItem('oauth_state');
            sessionStorage.removeItem('oauth_state');

            if (state && savedState && state === savedState) {
                try {
                    const res = await fetch(`${WORKER_URL}/api/exchange-token?code=${code}`, { credentials: 'include' });
                    const data = await res.json();
                    if (data.user) {
                        await PortalAuth.save(data.user, data.isAdmin);
                        window.history.replaceState({}, document.title, window.location.pathname);
                    }
                } catch (e) { console.error("Auth Callback Error", e); }
            } else {
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }

        // 2. 并发执行身份校验与数据加载
        await Promise.all([this.checkIdentity(), this.loadData()]);

        window.addEventListener('popstate', () => {
            // 当点击浏览器返回键时，重新检测 URL 决定是否显示弹窗
            const queryString = window.location.search.replace('?', '');
            if (queryString && queryString.startsWith('sub-')) {
                const target = this.allData.find(item => item.sub_id === queryString);
                this.detailItem = target || null;
            } else {
                this.detailItem = null;
            }
        });
    }
};

const app = createApp(AppOptions);
app.directive('lazy', lazyDirective);
app.mount('#app');