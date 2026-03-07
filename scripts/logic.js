import { TAG_CONFIG } from './config.js';

// 处理标签展开
function getExpandedTags(config, val) {
    if (!val) return [];
    if (!config) return [val];
    if (Array.isArray(config)) return [val];

    if (config[val]) {
        const subContent = config[val];
        if (!Array.isArray(subContent) || subContent.length === 0) {
            return [val];
        }
        return subContent.flat(Infinity);
    }
    return [val];
}

// 核心过滤函数
export function getFilteredList(data, search, selected, normalizeFn) {
    if (!data) return [];

    const query = search ? search.toLowerCase().trim() : "";

    // 检查是否有任何标签被选中
    const hasActiveTags = Object.values(selected).some(arr => arr && arr.length > 0);

    // 快速放行逻辑：如果搜索框为空且没有选中任何标签，直接返回原始数据
    // 这能确保“清除所有筛选”操作在 UI 上得到最快响应
    if (!query && !hasActiveTags) {
        return data;
    }

    // 1. Staff 强定位模式
    if (query.includes('sub-')) {
        return data.filter(item =>
            item.sub_id && item.sub_id.toLowerCase().includes(query)
        );
    }

    // 2. 普通过滤模式
    return data.filter(item => {
        // 侧边栏标签过滤
        const matchSidebarTags = Object.entries(selected).every(([cat, valList]) => {
            if (!valList || valList.length === 0) return true;
            const config = TAG_CONFIG[cat];

            return valList.every(val => {
                const allowedTags = getExpandedTags(config, val);
                return item.tags && item.tags.some(t => allowedTags.includes(t));
            });
        });

        if (!matchSidebarTags) return false;

        // 搜索框逻辑
        if (!query) return true;

        // #前缀模式
        if (query.startsWith('#')) {
            const tagQuery = query.slice(1);
            if (!tagQuery) return true;
            return item.tags && item.tags.some(t => t.toLowerCase().includes(tagQuery));
        }

        // 常规模糊匹配
        const normQuery = normalizeFn ? normalizeFn(query) : query;
        const normName = normalizeFn ? normalizeFn(item.name || "") : (item.name || "").toLowerCase();
        const normAuthor = normalizeFn ? normalizeFn(item.author || "") : (item.author || "").toLowerCase();
        const normDesc = normalizeFn ? normalizeFn(item.description || "") : (item.description || "").toLowerCase();

        const matchText = normName.includes(normQuery) ||
            normAuthor.includes(normQuery) ||
            normDesc.includes(normQuery);

        const matchTags = item.tags && item.tags.some(t => t.toLowerCase().includes(query));

        return matchText || matchTags;
    });
}

// 动态标签统计计算
export function calculateDynamicTags(data, categories, selected) {
    const groups = {};
    categories.forEach(cat => {
        const config = TAG_CONFIG[cat];
        const tagSet = new Set();
        if (!config) {
            groups[cat] = tagSet;
            return;
        }
        if (Array.isArray(config)) {
            config.forEach(tag => tagSet.add(tag));
        } else {
            Object.keys(config).forEach(subCat => {
                tagSet.add(subCat);
                const subTags = config[subCat];
                if (Array.isArray(subTags)) {
                    subTags.forEach(t => tagSet.add(t));
                }
            });
        }
        groups[cat] = tagSet;
    });
    return groups;
}

// 路径转义
export function getSafePath(path) {
    if (!path) return '';
    return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

