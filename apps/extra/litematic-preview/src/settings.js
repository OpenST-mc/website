// 初始化所有设置项
document.addEventListener('DOMContentLoaded', function() {
   const settings = document.querySelectorAll('.setting');
   settings.forEach(elem => {
      loadSetting(elem);

      elem.addEventListener('change', function() {
         let val = this.type === 'checkbox' ? this.checked : this.value;
         localStorage.setItem(this.getAttribute('data-setting'), val);
         console.log(`系统设置更新: ${this.getAttribute('data-setting')} -> ${val}`);
      });
   });
});

function loadSetting(elem) {
   const key = elem.getAttribute('data-setting');
   const savedValue = localStorage.getItem(key);

   // 记录默认值（用于重置）
   if (elem.type === 'checkbox') {
      elem.dataset.defaultValue = elem.checked;
      if (savedValue !== null) elem.checked = savedValue === 'true';
   } else {
      elem.dataset.defaultValue = elem.value;
      if (savedValue !== null) elem.value = savedValue;
   }
}

// 侧边栏逻辑
function openSettings() {
   const panel = document.getElementById("settings-panel");
   const gearBtn = document.getElementById("settings-button");

   const width = window.innerWidth < 600 ? "100%" : "400px";
   panel.style.width = width;

   if (gearBtn) {
      gearBtn.style.opacity = "0";
      gearBtn.style.pointerEvents = "none";
      gearBtn.style.transform = "rotate(90deg) scale(0.5)";
   }
}

function closeSettings() {
   const panel = document.getElementById("settings-panel");
   const gearBtn = document.getElementById("settings-button");
   panel.style.width = "0";
   if (gearBtn) {
      gearBtn.style.opacity = "1";
      gearBtn.style.pointerEvents = "auto";
      gearBtn.style.transform = "rotate(0deg) scale(1)";
   }
}

function resetSettings() {
   if(!confirm("确定要重置所有系统设置吗？")) return;

   localStorage.clear();
   const settings = document.querySelectorAll('.setting');
   settings.forEach(elem => {
      const def = elem.dataset.defaultValue;
      if (elem.type === 'checkbox') {
         elem.checked = def === 'true';
      } else {
         elem.value = def;
      }
   });
   console.log("设置已重置为系统默认");
}