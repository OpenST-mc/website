// 404 路由脚本：sub- 路径劫持与错误展示
const path = window.location.pathname.split('/').pop();
const searchingEl = document.getElementById('searching');
const errorBoxEl = document.getElementById('error-box');
const targetPathEl = document.getElementById('target-path');
const errorIdEl = document.getElementById('error-id');

// 显示当前解析的路径
targetPathEl.innerText = path ? `COORD: ${path}` : "ROOT_ACCESS";

async function handleRouting() {
    // 只有以 sub- 开头的路径才尝试劫持
    if (path && path.startsWith('sub-')) {
        try {
            // 1. 尝试获取数据库
            const res = await fetch('/data/database.json');
            const database = await res.json();

            // 2. 检查 ID 是否真的存在
            const exists = database.some(item => item.sub_id === path);

            if (exists) {
                // 命中目标，跳回主页并带上 hash
                window.location.replace('/#' + path);
                return;
            }
        } catch (e) {
            console.error("Database fetch failed", e);
        }
    }

    // 如果不是 sub- 开头，或者数据库里没找到
    setTimeout(() => {
        searchingEl.classList.add('hidden');
        errorBoxEl.classList.remove('hidden');
        errorIdEl.innerText = path || "null";
    }, 1000); // 给 1 秒的“分析”假象，提升仪式感
}

handleRouting();
