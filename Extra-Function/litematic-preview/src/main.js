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

         // 计算所有 Region 合并后的总包围盒和 max_y
         let max_y = 256;
         let totalSize = [0, 0, 0];
         if (structureLitematic.regions && structureLitematic.regions.length > 0) {
            var minY = 0, maxY = 0;
            var minX = 0, maxX = 0;
            var minZ = 0, maxZ = 0;
            var first = true;

            for (var ri = 0; ri < structureLitematic.regions.length; ri++) {
               var r = structureLitematic.regions[ri];
               var pos = r.position || [0, 0, 0];
               var s = r.size || [r.width, r.height, r.depth];
               var rh = r.height || s[1];

               if (rh > max_y) max_y = rh;

               if (first) {
                  minX = pos[0]; minY = pos[1]; minZ = pos[2];
                  maxX = pos[0] + s[0]; maxY = pos[1] + s[1]; maxZ = pos[2] + s[2];
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

         if (window.vEngine) {
            var structures = structuresFromLitematic(structureLitematic, 0, -1);
            window.vEngine.setStructures(structures);

            // 自动将相机移动到合并模型的中心
            glMatrix.vec3.set(window.vEngine.camera.pos,
               -totalSize[0] / 2, -totalSize[1] / 2, -totalSize[2] / 2);
         }

          createRangeSliders(max_y);
          const blockCounts = getMaterialList(structureLitematic);
          createMaterialsList(blockCounts);
          var cancelBtn = document.getElementById('cancel-preview-btn');
          if (cancelBtn) cancelBtn.classList.remove('hidden');
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
   const materialList = document.getElementById('settings-material-list');
   if (!materialList) return;

   var totalBlocks = Object.values(blockCounts).reduce(function(a, b) { return a + b; }, 0);

   var header = document.createElement('div');
   header.className = 'text-xs font-mono text-white/50 uppercase tracking-wider mb-2';
   header.innerText = 'Material List (' + totalBlocks + ' blocks)';

   materialList.innerHTML = '';
   materialList.appendChild(header);

   Object.entries(blockCounts)
       .sort(function(a, b) { return b[1] - a[1]; })
       .forEach(function(entry) {
          var key = entry[0];
          var val = entry[1];
          var item = document.createElement('div');
          item.className = 'count-item flex justify-between items-center group';
          item.innerHTML = '<span class="opacity-70 group-hover:opacity-100 transition-opacity">' +
             key.replace('minecraft:', '') + '</span>' +
             '<span class="font-mono text-[#40B5AD]">' + val + '</span>';
          materialList.appendChild(item);
       });

   var downloadBtn = document.createElement('button');
   downloadBtn.innerHTML = '<i class="material-icons" style="font-size:16px;vertical-align:middle">download</i> CSV';
   downloadBtn.className = 'w-full mt-2 py-1.5 border border-[#40B5AD]/30 hover:bg-[#40B5AD]/10 text-[#40B5AD] transition-all rounded text-xs font-mono uppercase';
   downloadBtn.onclick = function() {
      var csv = Object.entries(blockCounts).sort(function(a, b) { return b[1] - a[1]; })
         .map(function(e) { return e[0] + ',' + e[1]; }).join('\n');
      var blob = new Blob([csv], { type: 'text/csv' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'material_list.csv';
      a.click();
   };
   materialList.appendChild(downloadBtn);
}

function createRangeSliders(max_y) {
   const slidersDiv = document.getElementById('settings-sliders');
   if (!slidersDiv) return;

   slidersDiv.innerHTML = '';

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
    var updateScheduled = false;

    const updateView = () => {
       if (updateScheduled) return;
       updateScheduled = true;
       requestAnimationFrame(function() {
          updateScheduled = false;
          if (window.vEngine) {
             var actualMin = Math.min(y_min, y_max);
             var actualMax = Math.max(y_min, y_max);
             var structures = structuresFromLitematic(structureLitematic, actualMin, actualMax);
             window.vEngine.setStructures(structures);
          }
       });
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