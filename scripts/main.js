import * as Logic from './logic.js';
import * as UI from './ui.js';
import { TAG_CONFIG, CATEGORIES } from './config.js';
import { PortalAuth } from './auth.js';

const { createApp } = Vue;
const WORKER_URL = 'https://openstsubmission.linvin.net';

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
        searchQuery() { this.currentPage = 1; }
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

        // 下载链接生成
        getDownloadLink(item) {
            if (!item) return '';
            const path = `archive/${item.id}/${item.filename}`;
            const raw = `https://raw.githubusercontent.com/MC-OpenST/website/main/${path}`;
            const finalRaw = raw.replace('https://', 'https:/');
            return this.useProxy ? `https://cdn.linvin.net/${finalRaw}` : raw;
        },

        getPreviewUrl(item) {
            if (!item || !item.preview) return '';
            const rawPath = decodeURIComponent(item.preview);
            const safePath = rawPath.split('/').map(s => encodeURIComponent(s)).join('/');
            return `https://cdn.jsdmirror.com/gh/MC-OpenST/website@main/${safePath}`;
        },

        // 编辑跳转逻辑
        openEdit(item) {
            if (!item || !item.id) return;
            const folder = item.id.trim();
            // 确保跳转到 admin_tools 目录下的编辑器
            window.location.href = `./admin_tools/admin_edit.html?folder=${encodeURIComponent(folder)}`;
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
            // 彻底移除查询参数，恢复到 example.com/archive.html
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
            window.location.href = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo&redirect_uri=${encodeURIComponent(redirect_uri)}`;
        },
        async checkIdentity() {
            const auth = PortalAuth.get();
            if (!auth) return;
            this.user = auth.user;
            try {
                const res = await fetch(`${WORKER_URL}/api/check-admin`, {
                    headers: { 'Authorization': `Bearer ${auth.token}` }
                });
                const data = await res.json();
                this.isAdmin = data.isAdmin;
            } catch (e) { console.error("Admin check failed", e); }
        },
        handleLogout() {
            this.user = null;
            this.isAdmin = false;
            this.userToken = '';
            PortalAuth.logout();
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
    },

    async mounted() {
        // 1. 优先处理登录回调
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
            try {
                const res = await fetch(`${WORKER_URL}/api/exchange-token?code=${code}`);
                const data = await res.json();
                if (data.access_token) {
                    // 注意：这里必须 await，确保头像数据抓完存好
                    await PortalAuth.save(data, true);
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch (e) { console.error("Auth Callback Error", e); }
        }

        // 2. 统一身份校验
        await this.checkIdentity();

        // 3. 数据并行加载 (路径改回原版的 ./ 确保文件能找到)
        try {
            const [dataRes, dictRes] = await Promise.all([
                fetch('./data/database.json'), // 还原为 ./
                fetch('./Traditional-Simplefild/STCharacters.txt') // 还原为 ./
            ]);

            // 解析字典
            const dictText = await dictRes.text();

            // 确保定义了变量
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

            // 4. 数据加载完后再执行 URL 定位
            this.checkUrlLocation();
            if (this.detailItem) {
                document.title = `${this.detailItem.name} - OpenST 档案馆`;
            }

        } catch (e) {
            console.error("Data Load Error: 检查文件路径是否正确", e);
        }

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