// 系统状态页脚本：拨测主站 / API / CDN 可用性
const PORTAL_URL = 'https://openst.qzz.io/archive/不要动这是占位符！.txt';
const API_HEALTH_URL = 'https://openstsubmission.linvin.net/health';
const CDN_HEALTH_URL = 'https://cdn.linvin.net/gh/OpenST-mc/website@main/README.md';

let lastData = { portal: null, api: null, cdn: null};

// 带超时的 Fetch
async function fetchWithTimeout(url, options = {}, timeout = 6000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

async function updateUI(elId, status, ping = null) {
    const dot = document.getElementById(elId + '-dot');
    const text = document.getElementById(elId + '-ping');
    if (status === 'online') {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-green-500 dot-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]';
        if (text) text.innerText = ping + ' ms';
    } else {
        dot.className = 'w-2.5 h-2.5 rounded-full bg-red-600';
        if (text) text.innerText = 'TIMEOUT';
    }
}

async function check() {
    if (!navigator.onLine) {
        showMajorStatus('offline');
        return;
    }

    const vStart = Date.now();
    const portalPromise = fetchWithTimeout(PORTAL_URL, { mode: 'no-cors', cache: 'no-store' })
        .then(() => ({ ok: true, ping: Date.now() - vStart }))
        .catch(() => ({ ok: false }));

    const wStart = Date.now();
    const apiPromise = fetchWithTimeout(API_HEALTH_URL, { cache: 'no-store' })
        .then(r => r.json())
        .then(data => ({ ok: true, ping: Date.now() - wStart, ...data }))
        .catch(() => ({ ok: false }));

    const cdnStart = Date.now();
    const cdnPromise = fetchWithTimeout(CDN_HEALTH_URL, { mode: 'no-cors', cache: 'no-store' })
        .then(() => ({ ok: true, ping: Date.now() - cdnStart }))
        .catch(() => ({ ok: false }));

    const [portal, api, cdn] = await Promise.all([portalPromise, apiPromise, cdnPromise]);
    lastData = { portal, api, cdn };

    updateUI('portal', portal.ok ? 'online' : 'offline', portal.ping);
    updateUI('api', api.ok ? 'online' : 'offline', api.ping);
    updateUI('cdn', cdn.ok ? 'online' : 'offline', cdn.ping);

    if (api.ok) {
        document.getElementById('api-node').innerText = `NODE: ${api.region}`;
        document.getElementById('api-upstream').innerText = `UPSTREAM: ${api.upstream}`;
    }

    if (cdn.ok) {
        // 由于是 no-cors，我们拿不到详细 header，但可以标记为连接成功
        document.getElementById('cdn-status').innerText = `STATUS: OPERATIONAL`;
        document.getElementById('cdn-node').innerText = `NODE: EO_ANYCAST`;
    }

    // 综合判定逻辑
    if (portal.ok && api.ok && cdn.ok) {
        showMajorStatus('operational');
    } else if (!portal.ok && !api.ok && !cdn.ok) {
        showMajorStatus('major_outage');
    } else {
        showMajorStatus('partial_outage');
    }
}

function showMajorStatus(type) {
    const mainText = document.getElementById('main-text');
    const mainDot = document.getElementById('main-dot');
    const badge = document.getElementById('global-badge');
    const desc = document.getElementById('main-desc');

    const configs = {
        operational: {
            text: '所有系统运行正常',
            dot: 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]',
            badge: 'bg-green-900/30 text-green-400',
            badgeText: 'SYSTEM OPERATIONAL',
            desc: '当前所有服务均处于最佳运行状态'
        },
        partial_outage: {
            text: '部分服务响应异常',
            dot: 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]',
            badge: 'bg-yellow-900/30 text-yellow-400',
            badgeText: 'PARTIAL OUTAGE',
            desc: '核心功能可用，但部分链路存在延迟或抖动'
        },
        major_outage: {
            text: '核心服务完全失联',
            dot: 'bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.6)] dot-pulse',
            badge: 'bg-red-900/40 text-red-500 font-bold',
            badgeText: 'MAJOR OUTAGE',
            desc: '检测到大面积服务中断，技术团队可能正在处理'
        },
        offline: {
            text: '本地网络连接断开',
            dot: 'bg-zinc-600',
            badge: 'bg-zinc-800 text-zinc-500',
            badgeText: 'LOCAL OFFLINE',
            desc: '请检查您的设备网络连接后再试'
        }
    };

    const config = configs[type];
    mainText.innerText = config.text;
    mainText.className = `text-xl font-semibold ${type === 'operational' ? 'text-green-500' : type === 'major_outage' ? 'text-red-500' : 'text-yellow-500'}`;
    mainDot.className = `w-4 h-4 rounded-full transition-all duration-700 ${config.dot}`;
    badge.innerText = config.badgeText;
    badge.className = `px-3 py-1 rounded-full text-xs font-medium transition-colors ${config.badge} `;
    desc.innerText = config.desc;
}

function copyDebugInfo() {
    const info = `OpenST Status Report\n---\nPortal: ${lastData.portal?.ok ? lastData.portal.ping + 'ms' : 'Error'}\nAPI: ${lastData.api?.ok ? lastData.api.ping + 'ms' : 'Error'}\nNode: ${lastData.api?.region || 'Unknown'}\nUpstream: ${lastData.api?.upstream || 'Unknown'}\nTime: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(info).then(() => alert('诊断信息已复制到剪贴板'));
}

document.getElementById('btn-copy-debug').addEventListener('click', copyDebugInfo);
document.getElementById('btn-refresh').addEventListener('click', check);

check();
setInterval(check, 30000);
