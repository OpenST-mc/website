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

function findContextParent(config, tagName, activeVals) {
    if (!config || Array.isArray(config)) return null;

    // 优先寻找用户同时选中的那个父分类
    for (const subCat of Object.keys(config)) {
        if (Array.isArray(config[subCat]) && config[subCat].includes(tagName)) {
            // 如果用户选中的列表中包含这个父分类名，直接锁定
            if (activeVals.includes(subCat)) return subCat;
        }
    }

    // 如果没有同时选中，则按原样寻找第一个匹配项
    return Object.keys(config).find(subCat =>
        Array.isArray(config[subCat]) && config[subCat].includes(tagName)
    );
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
                const itemTags = item.tags || [];
                // 判断是否是子标签冲突区（例如：二进制）
                const subCat = findContextParent(config, val, valList);

                if (config[val] && !Array.isArray(config)) {
                    return itemTags.includes(val);
                }

                // 2. 如果 val 是子类（如“二进制”）
                if (subCat && subCat !== val) {
                    // 强制父子双重判定
                    return itemTags.includes(val) && itemTags.includes(subCat);
                }

                // 3. 兜底逻辑（针对没有层级的简单标签）
                const allowedTags = getExpandedTags(config, val);
                return itemTags.some(t => allowedTags.includes(t));
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

