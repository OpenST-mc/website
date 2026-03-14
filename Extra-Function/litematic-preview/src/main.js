var structureLitematic;

function loadAndProcessFile(file) {
   // 资源检查
   if (typeof deepslateResources === 'undefined' || deepslateResources == null) {
      console.error("Deepslate 资源未加载完成");
      return;
   }

   const fileName = file.name ? file.name.toLowerCase() : '';
   if (fileName && !fileName.endsWith('.litematic')) {
      alert(`检测到非投影文件: ${file.name}\n系统目前仅支持 .litematic 格式，请解压后再试。`);
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
      setTimeout(() => loaderPanel.style.display = 'none', 500);
   }

   let reader = new FileReader();
   reader.readAsArrayBuffer(file);

   reader.onload = function(evt) {
      try {
         const nbtdata = deepslate.readNbt(new Uint8Array(reader.result));
         structureLitematic = readLitematicFromNBTData(nbtdata);

         // 健壮性获取 max_y
         let max_y = 256; // 默认值
         if (structureLitematic.regions && structureLitematic.regions.length > 0) {
            const region = structureLitematic.regions[0];
            // 有些版本是 .size，有些可能需要从 blocks 的长度推算
            if (region.size) {
               max_y = Math.abs(region.size[1]);
            } else if (region.blocks && region.blocks[0]) {
               max_y = region.blocks[0].length;
            }
         }

         if (window.vEngine) {
            const structure = structureFromLitematic(structureLitematic);
            window.vEngine.setStructure(structure);

            // 自动将相机移动到模型中心
            if (structureLitematic.regions[0].size) {
               const s = structureLitematic.regions[0].size;
               glMatrix.vec3.set(window.vEngine.camera.pos, -s[0]/2, -s[1]/2, -s[2]/2);
            }
         }

         createRangeSliders(max_y);
         const blockCounts = getMaterialList(structureLitematic);
         createMaterialsList(blockCounts);
         hideLoading();

      } catch (err) {
         console.error("解析文件时出错:", err);
         hideLoading();
      }
   };

   reader.onerror = function() {
      console.error("读取文件失败:", reader.error);
      hideLoading();
   };
}

function createMaterialsList(blockCounts) {
   const materialList = document.getElementById('materialList');
   if (!materialList) return;

   // 渲染列表内容
   materialList.innerHTML = Object.entries(blockCounts)
       .sort(([,a], [,b]) => b - a)
       .map(([key, val]) => `
      <div class="count-item flex justify-between items-center group">
         <span class="opacity-70 group-hover:opacity-100 transition-opacity">${key.replace('minecraft:', '')}</span>
         <span class="font-mono text-[#40B5AD]">${val}</span>
      </div>`)
       .join('');

   const btn = document.getElementById('materialListButton');
   if (btn) btn.hidden = false;

   // 导出 CSV 功能
   const downloadBtn = document.createElement('button');
   downloadBtn.innerHTML = '<i class="material-icons" style="font-size:18px">download</i>';
   downloadBtn.className = "w-full mt-4 py-2 border border-[#40B5AD]/30 hover:bg-[#40B5AD]/10 text-[#40B5AD] transition-all rounded text-xs font-mono uppercase";
   downloadBtn.onclick = () => {
      const csv = Object.entries(blockCounts).sort(([,a], [,b]) => b-a).map(([k,v]) => `${k},${v}`).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'material_list.csv';
      a.click();
   };
   materialList.appendChild(downloadBtn);
}

function createRangeSliders(max_y) {
   const slidersDiv = document.getElementById('sliders');
   if (!slidersDiv) return;

   slidersDiv.innerHTML = ''; // 清空可能存在的旧滑块
   slidersDiv.className = "fixed bottom-10 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 w-64 glass-panel p-4";

   // 统一样式函数
   const createStyling = (el) => {
      el.className = "w-full accent-[#40B5AD] bg-white/10 h-1 rounded-lg appearance-none cursor-pointer";
   };

   const minLabel = document.createElement('div');
   minLabel.className = "text-[10px] font-mono text-white/40 uppercase";
   minLabel.innerText = "Height Min";

   const minSlider = document.createElement('input');
   minSlider.type = 'range';
   minSlider.min = 0;
   minSlider.max = max_y;
   minSlider.value = 0;
   createStyling(minSlider);

   const maxLabel = document.createElement('div');
   maxLabel.className = "text-[10px] font-mono text-white/40 uppercase mt-2";
   maxLabel.innerText = "Height Max";

   const maxSlider = document.createElement('input');
   maxSlider.type = 'range';
   maxSlider.min = 0;
   maxSlider.max = max_y;
   maxSlider.value = max_y;
   createStyling(maxSlider);

   let y_min = 0;
   let y_max = max_y;

   const updateView = () => {
      if (window.vEngine) {
         // 确保 y_min 不会大于 y_max
         const actualMin = Math.min(y_min, y_max);
         const actualMax = Math.max(y_min, y_max);

         const structure = structureFromLitematic(structureLitematic, actualMin, actualMax);
         window.vEngine.setStructure(structure);
      }
   };

   // 使用 oninput 实现实时预览，而非 onchange
   minSlider.oninput = (e) => {
      y_min = parseInt(e.target.value);
      updateView();
   };

   maxSlider.oninput = (e) => {
      y_max = parseInt(e.target.value);
      updateView();
   };

   slidersDiv.appendChild(minLabel);
   slidersDiv.appendChild(minSlider);
   slidersDiv.appendChild(maxLabel);
   slidersDiv.appendChild(maxSlider);
}