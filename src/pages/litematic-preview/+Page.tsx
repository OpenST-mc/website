import { useEffect } from 'react';
import { loadDeepslateResources } from './deepslate-helpers';
import { initPreviewUi } from './ui-init';
import { initSettings } from './settings';
import { loadScript } from './script-loader';
import { createEngine } from './viewer';
import { hideLoading } from './loading';
import { notify } from '../../lib/notify';
import './preview.css';

// Litematic Preview（/Extra-Function/litematic-preview）：
// 本组件只渲染静态 JSX 外壳；WebGL/解析核心在命令式 TS 模块中，于挂载后按序初始化。
const RESOURCE_BASE = '/Extra-Function/litematic-preview/resource';

export default function Page() {
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      try {
        await loadScript('/vendor/deepslate.umd.js');
        await loadScript('/vendor/gl-matrix-min.js');
        await loadScript(`${RESOURCE_BASE}/assets.js`);
        await loadScript(`${RESOURCE_BASE}/opaque.js`);
        if (cancelled) return;

        const atlas = document.getElementById('atlas') as HTMLImageElement | null;
        if (!atlas) throw new Error('Missing atlas image');
        if (!atlas.complete) {
          await new Promise<void>((resolve) => {
            atlas.addEventListener('load', () => resolve(), { once: true });
          });
        }
        if (cancelled) return;

        const resources = loadDeepslateResources(atlas);

        const viewer = document.getElementById('viewer');
        if (viewer) viewer.replaceChildren();
        createEngine('viewer', resources);

        initSettings();
        cleanup = initPreviewUi();
      } catch (error) {
        console.error('预览初始化失败:', error);
        if (!cancelled) {
          hideLoading();
          notify('error', '预览资源加载失败，请刷新页面重试');
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return (
    <>
      <div className="top-bar"></div>

      <div id="viewer"></div>

      {/* 移动端触控提示 */}
      <div id="touch-hints" className="fixed inset-0 hidden">
        <div className="hint-left">
          <div className="hint-text">
            <span className="hint-icon material-icons">touch_app</span>
            单指移动
          </div>
        </div>
        <div className="hint-right">
          <div className="hint-text">
            <span className="hint-icon material-icons">rotate_right</span>
            单指旋转
          </div>
        </div>
      </div>

      <div id="vertical-controls" className="hidden">
        <button id="btn-up">
          <i className="material-icons">keyboard_arrow_up</i>
        </button>
        <button id="btn-down">
          <i className="material-icons">keyboard_arrow_down</i>
        </button>
      </div>

      <div
        id="loading-overlay"
        className="fixed inset-0 z-[999] bg-black/80 flex justify-center items-center hidden"
      >
        <div className="flex flex-col items-center">
          <div className="spinner border-4 border-t-[#40B5AD] border-white/20 rounded-full w-12 h-12 animate-spin mb-4"></div>
          <p className="text-[#40B5AD] font-mono text-xs tracking-widest">DECODING_NBT...</p>
        </div>
      </div>

      <a
        href="#"
        id="settings-button"
        className="fixed top-6 right-8 z-[110] text-white/70 hover:text-[#40B5AD] transition-all"
      >
        <i className="fa fa-cog"></i>
      </a>

      <div
        id="main-content"
        className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 transition-all duration-700"
      >
        <div className="glass-panel max-w-2xl w-full p-10 text-center">
          <h1 className="text-3xl font-black tracking-tighter mb-2 text-[#40B5AD] italic">投影预览系统</h1>
          <p className="text-xs font-mono text-white/60 mb-10 uppercase tracking-[0.3em]">
            Litematic Preview
          </p>

          <div id="file-loader-panel">
            <input id="file-upload" type="file" hidden />
            <label htmlFor="file-upload" id="drop-zone">
              <div className="flex flex-col items-center pointer-events-none">
                <i className="material-icons text-5xl text-[#40B5AD] mb-4">cloud_upload</i>
                <h3 className="text-xl font-bold mb-1">选择投影</h3>
                <p className="text-sm text-white/60">选择/拖拽.litematic文件</p>
              </div>
            </label>

            <div className="mt-12">
              <div className="relative group">
                <input
                  id="remote-url-input"
                  type="text"
                  placeholder="Paste remote link here..."
                  className="w-full bg-white/5 border-b border-white/10 p-4 focus:outline-none focus:border-[#40B5AD] transition-all font-mono text-sm"
                />
                <button id="submit-remote-btn" className="absolute right-2 top-2 p-2 text-[#40B5AD]">
                  <i className="material-icons">send</i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="settings-panel">
        <a href="#" id="settings-close" className="absolute top-6 right-6 text-3xl text-white/70 hover:text-white">
          &times;
        </a>
        <div className="p-8">
          <h3 className="text-xl font-bold text-[#40B5AD] mb-8 font-mono">设置</h3>
          <button
            id="cancel-preview-btn"
            className="w-full py-3 mb-10 bg-red-900/40 border border-red-500/50 text-red-200 text-xs font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all hidden"
          >
            取消预览
          </button>
          <div id="settings-sliders" className="mb-8 space-y-3"></div>
          {/* 镜像模式 */}
          <label className="flex items-center gap-3 mb-8 cursor-pointer">
            <input
              type="checkbox"
              id="mirror-toggle"
              className="sr-only setting"
              data-setting="mirrorMode"
            />
            <div className="w-10 h-5 rounded-full bg-white/10 border border-white/20 transition-colors relative">
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[#40B5AD] transition-transform"></div>
            </div>
            <span className="text-xs font-mono text-white/60">Mirror View</span>
          </label>
          <div id="settings-material-list" className="max-h-[40vh] overflow-y-auto mb-8 space-y-1"></div>
          <div id="settings-container" className="space-y-6"></div>
        </div>
      </div>

      <img id="atlas" src={`${RESOURCE_BASE}/atlas.png`} crossOrigin="anonymous" hidden alt="" />
    </>
  );
}
