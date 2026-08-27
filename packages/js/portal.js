// 门户页脚本：彩蛋过渡动画、字体解锁、控制台安全提示
(function() {
    let clickCount = 0;
    let lastClickTime = 0;

    // 同时获取桌面端和移动端的触发元素
    const desktopTrigger = document.getElementById('credits-trigger');
    const mobileTrigger = document.querySelector('p.text-gray-600');

    const handleSecretAction = () => {
        const currentTime = Date.now();
        if (currentTime - lastClickTime > 800) {
            clickCount = 0;
        }

        clickCount++;
        lastClickTime = currentTime;
        const activeTrigger = window.innerWidth < 640 ? mobileTrigger : desktopTrigger;
        if (activeTrigger) {
            activeTrigger.style.filter = 'brightness(2)';
            activeTrigger.style.transition = 'filter 0.1s';
            setTimeout(() => { activeTrigger.style.filter = 'brightness(1)'; }, 100);
        }

        if (clickCount === 5) {
            clickCount = 0;
            triggerTransition();
        }
    };

    const triggerTransition = () => {
        window.scrollTo(0, 0);
        document.documentElement.style.overflow = 'hidden';
        const overlay = document.createElement('div');
        overlay.id = 'transition-overlay';
        overlay.innerHTML = `
        <div class="scan-line"></div>
        <div id="app" class="relative z-10 text-center px-6">
            <div id="searching" class="space-y-6">
                <div class="relative w-24 h-24 mx-auto">
                    <div class="absolute inset-0 border-4 border-[#40B5AD]/10 rounded-full"></div>
                    <div class="absolute inset-0 border-4 border-t-[#40B5AD] rounded-full animate-spin"></div>
                </div>
                <div class="space-y-2">
                    <h2 class="text-2xl font-black tracking-[0.3em] text-[#40B5AD] brand-shadow uppercase">Bypassing...</h2>
                    <p id="inject-log" class="text-white/30 font-mono text-xs tracking-widest uppercase">GATE: INITIALIZING...</p>
                </div>
            </div>
        </div>
    `;

        const style = document.createElement('style');
        style.innerHTML = `
        #transition-overlay { position: fixed; inset: 0; background: #0a0a0a; z-index: 9999; display: flex; align-items: center; justify-content: center; }
        .scan-line { width: 100%; height: 2px; background: linear-gradient(90deg, transparent, #40B5AD, transparent); position: fixed; top: 0; z-index: 10000; animation: scan 2s linear infinite; }
        @keyframes scan { 0% { top: 0%; } 100% { top: 100%; } }
        .brand-shadow { text-shadow: 0 0 20px rgba(64, 181, 173, 0.5); }
    `;

        document.head.appendChild(style);
        document.body.appendChild(overlay);

        const logs = ["SPOOFING_IP...", "DECRYPTING_V_FILES...", "BYPASSING_GATE...", "ACCESS_GRANTED"];
        let i = 0;
        const logEl = overlay.querySelector('#inject-log');

        const interval = setInterval(() => {
            if (i < logs.length) {
                logEl.innerText = `STATUS: ${logs[i]}`;
                i++;
            } else {
                clearInterval(interval);
                window.location.href = 'profile/april/december/credits.html';
            }
        }, 600);
    };

    // 绑定事件
    if (desktopTrigger) desktopTrigger.addEventListener('click', handleSecretAction);
    if (mobileTrigger) {
        mobileTrigger.style.cursor = 'pointer';
        mobileTrigger.addEventListener('click', handleSecretAction);
    }
})();

(function() {
    const unlockSystem = () => {
        const skeletons = document.querySelectorAll('.loading-skeleton');
        skeletons.forEach(el => el.classList.remove('loading-skeleton'));
        document.body.classList.add('ready');
        console.log("%c字体加载成功", "color: #40B5AD; font-weight: bold;");
    };
    if ('fonts' in document) {
        document.fonts.ready.then(() => {
            setTimeout(unlockSystem, 200);
        });
    } else {
        window.onload = unlockSystem;
    }
    setTimeout(() => {
        const skeletons = document.querySelectorAll('.loading-skeleton');
        if (skeletons.length > 0 && skeletons[0].classList.contains('loading-skeleton')) {
            console.warn("SYSTEM: FONT_LOAD_TIMEOUT, FORCING_DISPLAY");
            unlockSystem();
        }
    }, 2500);
})();

console.log(
    "%c如果你并非网页开发人员，请勿在控制台内输入任何人传给你的脚本！\n%c在控制台输入脚本可能会让攻击者盗取你的 GitHub 访问令牌（Token），从而控制你的仓库或篡改数据。",
    "color: #333; font-size: 16px; font-weight: bold;",
    "color: red; font-size: 14px;"
);
