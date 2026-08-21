// 预览页 UI 初始化与事件绑定（从 index.html 内联脚本迁移）
document.addEventListener("DOMContentLoaded", () => {
    const image = document.getElementById('atlas');
    const initResources = () => loadDeepslateResources(image);

    if (image.complete) initResources();
    else image.addEventListener('load', initResources);

    // 恢复镜像模式
    var mirrorCb = document.getElementById('mirror-toggle');
    if (mirrorCb && mirrorCb.checked && window.vEngine) {
        window.vEngine.mirrorMode = true;
        applyMirrorLayout(true);
    }

    // 绑定按钮事件（替代内联 onclick）
    var settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
        settingsButton.addEventListener('click', function (e) {
            e.preventDefault();
            openSettings();
        });
    }

    var settingsClose = document.getElementById('settings-close');
    if (settingsClose) {
        settingsClose.addEventListener('click', function (e) {
            e.preventDefault();
            closeSettings();
        });
    }

    var submitBtn = document.getElementById('submit-remote-btn');
    if (submitBtn) submitBtn.addEventListener('click', submitRemoteFile);

    var fileInput = document.getElementById('file-upload');
    if (fileInput) fileInput.addEventListener('change', function () { readFileInput(this); });

    var dropZone = document.getElementById('drop-zone');
    if (dropZone) {
        dropZone.addEventListener('drop', dropHandler);
        dropZone.addEventListener('dragover', dragOverHandler);
    }

    var cancelBtn = document.getElementById('cancel-preview-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
            history.replaceState(null, '', ' ');
            location.reload();
        });
    }

    if (mirrorCb) {
        mirrorCb.addEventListener('change', function () {
            var m = this.checked;
            if (window.vEngine) window.vEngine.mirrorMode = m;
            applyMirrorLayout(m);
        });
    }

    // 检查 ?viewerUse=URL 参数
    var params = new URLSearchParams(window.location.search);
    var viewerUse = params.get('viewerUse');
    if (viewerUse) {
        var mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
            setTimeout(function() { mainContent.style.display = 'none'; }, 500);
        }
        readFileURL(viewerUse);
        return;
    }

    // 执行哈希路由检查
    handleHashRoute();
});

// #https://...
function handleHashRoute() {
    const hash = window.location.hash.substring(1); // 去掉开头的 #
    if (hash && hash.startsWith('http')) {
        console.log(`🚀 发现哈希路由: ${hash}`);

        // 同步显示到输入框（视觉反馈）
        const urlInput = document.getElementById('remote-url-input');
        if (urlInput) urlInput.value = hash;

        readFileURL(hash);
    }
}

// 监听地址栏手动修改
window.addEventListener('hashchange', handleHashRoute);
// 文件上传统一入口 (适配 File 和 Blob)
function handleFileSelection(file) {
    if (!file) return;
    showLoading();

    // 隐藏主面板的动画
    const main = document.getElementById('main-content');
    main.classList.add('opacity-0', 'pointer-events-none', 'scale-95');

    if (typeof loadAndProcessFile === 'function') {
        loadAndProcessFile(file);
    }
}

function readFileInput(input) {
    if (input.files && input.files[0]) handleFileSelection(input.files[0]);
}

function dropHandler(ev) {
    ev.preventDefault();
    const file = ev.dataTransfer.items ? ev.dataTransfer.items[0].getAsFile() : ev.dataTransfer.files[0];
    handleFileSelection(file);
}

function dragOverHandler(ev) { ev.preventDefault(); }

function submitRemoteFile() {
    const urlInput = document.getElementById('remote-url-input');
    const url = urlInput.value.trim();
    if (url) {
        readFileURL(url);
    } else {
        alert("请先输入有效的 URL 链接");
    }
}

function readFileURL(url) {
    showLoading();
    console.log(`正在发起请求: ${url}`);

    // 直接 Fetch，不经过任何中转
    fetch(url, { mode: 'cors' })
        .then(res => {
            if (!res.ok) throw new Error(`服务器响应失败: ${res.status}`);
            return res.blob();
        })
        .then(blob => {
            // 将 Blob 传递给解析引擎
            handleFileSelection(blob);
        })
        .catch(err => {
            console.error("失败:", err);
            alert("远程加载失败。请检查：\n1. 链接是否正确\n2. 目标服务器是否允许 CORS 跨域访问");
            hideLoading();
            // 恢复 UI 状态
            const main = document.getElementById('main-content');
            main.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
        });
}

function showLoading() { document.getElementById('loading-overlay').classList.remove('hidden'); }
function hideLoading() { document.getElementById('loading-overlay').classList.add('hidden'); }

function applyMirrorLayout(mirror) {
    var leftHint = document.querySelector('#touch-hints .hint-left');
    var rightHint = document.querySelector('#touch-hints .hint-right');
    var vCtrl = document.getElementById('vertical-controls');
    if (mirror) {
        if (leftHint) {
            leftHint.querySelector('.hint-text').innerHTML = '<span class="hint-icon material-icons">rotate_right</span>单指旋转';
            leftHint.style.background = 'linear-gradient(135deg, rgba(255, 50, 50, 0.10) 0%, transparent 100%)';
        }
        if (rightHint) {
            rightHint.querySelector('.hint-text').innerHTML = '<span class="hint-icon material-icons">touch_app</span>单指移动';
            rightHint.style.background = 'linear-gradient(225deg, rgba(0, 200, 0, 0.15) 0%, transparent 100%)';
        }
        if (vCtrl) { vCtrl.style.right = 'auto'; vCtrl.style.left = '20px'; }
    } else {
        if (leftHint) {
            leftHint.querySelector('.hint-text').innerHTML = '<span class="hint-icon material-icons">touch_app</span>单指移动';
            leftHint.style.background = '';
        }
        if (rightHint) {
            rightHint.querySelector('.hint-text').innerHTML = '<span class="hint-icon material-icons">rotate_right</span>单指旋转';
            rightHint.style.background = '';
        }
        if (vCtrl) { vCtrl.style.left = 'auto'; vCtrl.style.right = '20px'; }
    }
}
