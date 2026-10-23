// 预览页 UI 初始化与事件绑定（自 apps/extra/litematic-preview/src/ui-init.js 迁移）。
import { loadAndProcessFile } from './main';
import { closeSettings, openSettings } from './settings';
import { hideLoading, showLoading } from './loading';
import { getEngine } from './viewer';
import { notify } from '../../lib/notify';

// #https://...
function handleHashRoute(): void {
  const hash = window.location.hash.substring(1); // 去掉开头的 #
  if (hash && hash.startsWith('http')) {
    console.log(`发现哈希路由: ${hash}`);

    // 同步显示到输入框（视觉反馈）
    const urlInput = document.getElementById('remote-url-input') as HTMLInputElement | null;
    if (urlInput) urlInput.value = hash;

    readFileURL(hash);
  }
}

// 文件上传统一入口 (适配 File 和 Blob)
function handleFileSelection(file: File | Blob | null): void {
  if (!file) return;
  showLoading();

  // 隐藏主面板的动画
  const main = document.getElementById('main-content');
  main?.classList.add('opacity-0', 'pointer-events-none', 'scale-95');

  loadAndProcessFile(file);
}

function readFileInput(input: HTMLInputElement): void {
  const files = input.files;
  if (files && files[0]) handleFileSelection(files[0]);
}

function dropHandler(ev: DragEvent): void {
  ev.preventDefault();
  const items = ev.dataTransfer?.items;
  const file = items ? items[0]?.getAsFile() : ev.dataTransfer?.files[0];
  handleFileSelection(file ?? null);
}

function dragOverHandler(ev: DragEvent): void {
  ev.preventDefault();
}

function submitRemoteFile(): void {
  const urlInput = document.getElementById('remote-url-input') as HTMLInputElement | null;
  const url = urlInput?.value.trim() ?? '';
  if (url) {
    readFileURL(url);
  } else {
    notify('error', '请先输入有效的 URL 链接');
  }
}

function readFileURL(url: string): void {
  showLoading();
  console.log(`正在发起请求: ${url}`);

  // 直接 Fetch，不经过任何中转
  fetch(url, { mode: 'cors' })
    .then((res) => {
      if (!res.ok) throw new Error(`服务器响应失败: ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      // 将 Blob 传递给解析引擎
      handleFileSelection(blob);
    })
    .catch((err) => {
      console.error('失败:', err);
      notify('error', '远程加载失败。请检查：1. 链接是否正确 2. 目标服务器是否允许 CORS 跨域访问');
      hideLoading();
      // 恢复 UI 状态
      const main = document.getElementById('main-content');
      main?.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
    });
}

function applyMirrorLayout(mirror: boolean): void {
  const leftHint = document.querySelector<HTMLElement>('#touch-hints .hint-left');
  const rightHint = document.querySelector<HTMLElement>('#touch-hints .hint-right');
  const vCtrl = document.getElementById('vertical-controls');

  const setHint = (hint: HTMLElement | null, icon: string, text: string, background: string) => {
    if (!hint) return;
    const textEl = hint.querySelector<HTMLElement>('.hint-text');
    if (textEl) textEl.innerHTML = `<span class="hint-icon material-icons">${icon}</span>${text}`;
    hint.style.background = background;
  };

  if (mirror) {
    setHint(
      leftHint,
      'rotate_right',
      '单指旋转',
      'linear-gradient(135deg, rgba(255, 50, 50, 0.10) 0%, transparent 100%)',
    );
    setHint(rightHint, 'touch_app', '单指移动', 'linear-gradient(225deg, rgba(0, 200, 0, 0.15) 0%, transparent 100%)');
    if (vCtrl) {
      vCtrl.style.right = 'auto';
      vCtrl.style.left = '20px';
    }
  } else {
    setHint(leftHint, 'touch_app', '单指移动', '');
    setHint(rightHint, 'rotate_right', '单指旋转', '');
    if (vCtrl) {
      vCtrl.style.left = 'auto';
      vCtrl.style.right = '20px';
    }
  }
}

// 预览页初始化（资源与引擎就绪后调用），返回清理函数。
export function initPreviewUi(): () => void {
  const cleanups: Array<() => void> = [];

  // 恢复镜像模式
  const mirrorCb = document.getElementById('mirror-toggle') as HTMLInputElement | null;
  if (mirrorCb && mirrorCb.checked) {
    const engine = getEngine();
    if (engine) engine.mirrorMode = true;
    applyMirrorLayout(true);
  }

  // 绑定按钮事件（替代内联 onclick）
  const settingsButton = document.getElementById('settings-button');
  if (settingsButton) {
    const onClick = (e: Event) => {
      e.preventDefault();
      openSettings();
    };
    settingsButton.addEventListener('click', onClick);
    cleanups.push(() => settingsButton.removeEventListener('click', onClick));
  }

  const settingsClose = document.getElementById('settings-close');
  if (settingsClose) {
    const onClick = (e: Event) => {
      e.preventDefault();
      closeSettings();
    };
    settingsClose.addEventListener('click', onClick);
    cleanups.push(() => settingsClose.removeEventListener('click', onClick));
  }

  const submitBtn = document.getElementById('submit-remote-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', submitRemoteFile);
    cleanups.push(() => submitBtn.removeEventListener('click', submitRemoteFile));
  }

  const fileInput = document.getElementById('file-upload') as HTMLInputElement | null;
  if (fileInput) {
    const onChange = () => readFileInput(fileInput);
    fileInput.addEventListener('change', onChange);
    cleanups.push(() => fileInput.removeEventListener('change', onChange));
  }

  const dropZone = document.getElementById('drop-zone');
  if (dropZone) {
    const onDrop = (e: Event) => dropHandler(e as DragEvent);
    const onDragOver = (e: Event) => dragOverHandler(e as DragEvent);
    dropZone.addEventListener('drop', onDrop);
    dropZone.addEventListener('dragover', onDragOver);
    cleanups.push(() => {
      dropZone.removeEventListener('drop', onDrop);
      dropZone.removeEventListener('dragover', onDragOver);
    });
  }

  const cancelBtn = document.getElementById('cancel-preview-btn');
  if (cancelBtn) {
    const onClick = () => {
      history.replaceState(null, '', ' ');
      location.reload();
    };
    cancelBtn.addEventListener('click', onClick);
    cleanups.push(() => cancelBtn.removeEventListener('click', onClick));
  }

  if (mirrorCb) {
    const onChange = () => {
      const m = mirrorCb.checked;
      const engine = getEngine();
      if (engine) engine.mirrorMode = m;
      applyMirrorLayout(m);
    };
    mirrorCb.addEventListener('change', onChange);
    cleanups.push(() => mirrorCb.removeEventListener('change', onChange));
  }

  // 监听地址栏手动修改
  window.addEventListener('hashchange', handleHashRoute);
  cleanups.push(() => window.removeEventListener('hashchange', handleHashRoute));

  // 检查 ?viewerUse=URL 参数
  const params = new URLSearchParams(window.location.search);
  const viewerUse = params.get('viewerUse');
  if (viewerUse) {
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
      setTimeout(() => {
        mainContent.style.display = 'none';
      }, 500);
    }
    readFileURL(viewerUse);
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  }

  // 执行哈希路由检查
  handleHashRoute();

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
