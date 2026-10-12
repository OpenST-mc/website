// 文件解析入口与材质/高度控件（自 apps/extra/litematic-preview/src/main.js 迁移）。
import type { NbtCompound, Litematic, RawLitematicNbt } from './types';
import { getDeepslateResources, structuresFromLitematic } from './deepslate-helpers';
import { getMaterialList, readLitematicFromNBTData } from './litematic-utils';
import { hideLoading } from './loading';
import { getEngine } from './viewer';
import { notify } from '../../lib/notify';

let structureLitematic: Litematic | null = null;

function isFile(value: File | Blob): value is File {
  return 'name' in value;
}

export function loadAndProcessFile(file: File | Blob): void {
  // 资源检查
  if (!getDeepslateResources()) {
    console.error('Deepslate 资源未加载完成');
    return;
  }

  const fileName = isFile(file) && file.name ? file.name.toLowerCase() : '';
  if (fileName && !fileName.endsWith('.litematic')) {
    notify('error', `检测到非投影文件: ${isFile(file) ? file.name : ''}，系统目前仅支持 .litematic 格式，请解压后再试。`);
    hideLoading();
    // 恢复 UI
    const mainUI = document.getElementById('main-content');
    if (mainUI) {
      mainUI.style.display = 'flex';
      mainUI.classList.remove('opacity-0', 'pointer-events-none');
    }
    return;
  }

  // 优雅处理 UI 切换，不再暴力删除元素
  const loaderPanel = document.getElementById('main-content');
  if (loaderPanel) {
    loaderPanel.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
    // 延迟给一点动画时间
    setTimeout(() => (loaderPanel.style.display = 'none'), 500);
  }

  const reader = new FileReader();
  reader.readAsArrayBuffer(file);

  reader.onload = function () {
    try {
      const buffer = reader.result;
      if (!(buffer instanceof ArrayBuffer)) return;
      const nbtdata = deepslate.readNbt(new Uint8Array(buffer));
      structureLitematic = readLitematicFromNBTData(nbtdata as unknown as RawLitematicNbt);
      // 释放 NBT 包装数据，仅保留 packedData（原实现同）
      (nbtdata as unknown as { value: NbtCompound | null }).value = null;

      // 计算所有 Region 合并后的总包围盒和 max_y
      let max_y = 256;
      let totalSize: [number, number, number] = [0, 0, 0];
      if (structureLitematic.regions && structureLitematic.regions.length > 0) {
        let minY = 0,
          maxY = 0;
        let minX = 0,
          maxX = 0;
        let minZ = 0,
          maxZ = 0;
        let first = true;

        for (const r of structureLitematic.regions) {
          const pos = r.position || [0, 0, 0];
          const s = r.size || [r.width, r.height, r.depth];
          const rh = r.height || s[1];

          if (rh > max_y) max_y = rh;

          if (first) {
            minX = pos[0];
            minY = pos[1];
            minZ = pos[2];
            maxX = pos[0] + s[0];
            maxY = pos[1] + s[1];
            maxZ = pos[2] + s[2];
            first = false;
          } else {
            if (pos[0] < minX) minX = pos[0];
            if (pos[1] < minY) minY = pos[1];
            if (pos[2] < minZ) minZ = pos[2];
            if (pos[0] + s[0] > maxX) maxX = pos[0] + s[0];
            if (pos[1] + s[1] > maxY) maxY = pos[1] + s[1];
            if (pos[2] + s[2] > maxZ) maxZ = pos[2] + s[2];
          }
        }
        totalSize = [maxX - minX, maxY - minY, maxZ - minZ];
      }

      const engine = getEngine();
      if (engine) {
        const structures = structuresFromLitematic(structureLitematic, 0, -1);
        engine.setStructures(structures);

        // 自动将相机移动到合并模型的中心
        glMatrix.vec3.set(
          engine.camera.pos,
          -totalSize[0] / 2,
          -totalSize[1] / 2,
          -totalSize[2] / 2
        );
      }

      createRangeSliders(max_y);
      const blockCounts = getMaterialList(structureLitematic);
      createMaterialsList(blockCounts);
      const cancelBtn = document.getElementById('cancel-preview-btn');
      if (cancelBtn) cancelBtn.classList.remove('hidden');
      hideLoading();
    } catch (err) {
      console.error('解析文件时出错:', err);
      hideLoading();
    }
  };

  reader.onerror = function () {
    console.error('读取文件失败:', reader.error);
    hideLoading();
  };
}

export function createMaterialsList(blockCounts: Record<string, number>): void {
  const materialList = document.getElementById('settings-material-list');
  if (!materialList) return;

  const totalBlocks = Object.values(blockCounts).reduce(function (a, b) {
    return a + b;
  }, 0);

  const header = document.createElement('div');
  header.className = 'text-xs font-mono text-white/70 uppercase tracking-wider mb-2';
  header.innerText = 'Material List (' + totalBlocks + ' blocks)';

  materialList.innerHTML = '';
  materialList.appendChild(header);

  Object.entries(blockCounts)
    .sort(function (a, b) {
      return b[1] - a[1];
    })
    .forEach(function (entry) {
      const key = entry[0];
      const val = entry[1];
      const item = document.createElement('div');
      item.className = 'count-item flex justify-between items-center group';
      // 材质名来自用户上传文件：只用 textContent，杜绝 HTML 注入。
      const nameSpan = document.createElement('span');
      nameSpan.className = 'opacity-70 group-hover:opacity-100 transition-opacity';
      nameSpan.textContent = key.replace('minecraft:', '');
      const countSpan = document.createElement('span');
      countSpan.className = 'font-mono text-[#40B5AD]';
      countSpan.textContent = String(val);
      item.append(nameSpan, countSpan);
      materialList.appendChild(item);
    });

  const downloadBtn = document.createElement('button');
  downloadBtn.innerHTML =
    '<i class="material-icons" style="font-size:16px;vertical-align:middle">download</i> CSV';
  downloadBtn.className =
    'w-full mt-2 py-1.5 border border-[#40B5AD]/30 hover:bg-[#40B5AD]/10 text-[#40B5AD] transition-all rounded text-xs font-mono uppercase';
  downloadBtn.onclick = function () {
    const csv = Object.entries(blockCounts)
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .map(function (e) {
        return e[0] + ',' + e[1];
      })
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'material_list.csv';
    a.click();
  };
  materialList.appendChild(downloadBtn);
}

export function createRangeSliders(max_y: number): void {
  const slidersDiv = document.getElementById('settings-sliders');
  if (!slidersDiv) return;

  slidersDiv.innerHTML = '';

  const createStyling = (el: HTMLInputElement) => {
    el.className = 'w-full accent-[#40B5AD] bg-white/10 h-1 rounded-lg appearance-none cursor-pointer';
  };

  const minLabel = document.createElement('div');
  minLabel.className = 'text-[10px] font-mono text-white/60 uppercase';
  minLabel.innerText = 'Height Min';

  const minSlider = document.createElement('input');
  minSlider.type = 'range';
  minSlider.min = '0';
  minSlider.max = String(max_y);
  minSlider.value = '0';
  createStyling(minSlider);

  const maxLabel = document.createElement('div');
  maxLabel.className = 'text-[10px] font-mono text-white/60 uppercase mt-2';
  maxLabel.innerText = 'Height Max';

  const maxSlider = document.createElement('input');
  maxSlider.type = 'range';
  maxSlider.min = '0';
  maxSlider.max = String(max_y);
  maxSlider.value = String(max_y);
  createStyling(maxSlider);

  let y_min = 0;
  let y_max = max_y;
  let updateScheduled = false;

  const updateView = () => {
    if (updateScheduled) return;
    updateScheduled = true;
    requestAnimationFrame(function () {
      updateScheduled = false;
      const engine = getEngine();
      if (engine && structureLitematic) {
        const actualMin = Math.min(y_min, y_max);
        const actualMax = Math.max(y_min, y_max);
        const structures = structuresFromLitematic(structureLitematic, actualMin, actualMax);
        engine.setStructures(structures);
      }
    });
  };

  // 使用 oninput 实现实时预览，而非 onchange
  minSlider.oninput = (e) => {
    y_min = parseInt((e.target as HTMLInputElement).value, 10);
    updateView();
  };

  maxSlider.oninput = (e) => {
    y_max = parseInt((e.target as HTMLInputElement).value, 10);
    updateView();
  };

  slidersDiv.appendChild(minLabel);
  slidersDiv.appendChild(minSlider);
  slidersDiv.appendChild(maxLabel);
  slidersDiv.appendChild(maxSlider);
}
