// 设置项持久化与侧边栏（自 apps/extra/litematic-preview/src/settings.js 迁移）。
type SettingElement = HTMLInputElement | HTMLSelectElement;

function isSettingElement(elem: Element): elem is SettingElement {
  return elem instanceof HTMLInputElement || elem instanceof HTMLSelectElement;
}

function readSettingValue(elem: SettingElement): string | boolean {
  return elem.type === 'checkbox' ? (elem as HTMLInputElement).checked : elem.value;
}

function loadSetting(elem: SettingElement): void {
  const key = elem.getAttribute('data-setting');
  if (!key) return;
  const savedValue = localStorage.getItem(key);

  // 记录默认值（用于重置）
  if (elem.type === 'checkbox') {
    elem.dataset.defaultValue = String((elem as HTMLInputElement).checked);
    if (savedValue !== null) (elem as HTMLInputElement).checked = savedValue === 'true';
  } else {
    elem.dataset.defaultValue = elem.value;
    if (savedValue !== null) elem.value = savedValue;
  }
}

// 初始化所有设置项
export function initSettings(): void {
  const settings = document.querySelectorAll('.setting');
  settings.forEach((elem) => {
    if (!isSettingElement(elem)) return;
    loadSetting(elem);

    elem.addEventListener('change', () => {
      const val = readSettingValue(elem);
      localStorage.setItem(elem.getAttribute('data-setting') ?? '', String(val));
      console.log(`系统设置更新: ${elem.getAttribute('data-setting')} -> ${val}`);
    });
  });
}

// 侧边栏逻辑
export function openSettings(): void {
  const panel = document.getElementById('settings-panel');
  const gearBtn = document.getElementById('settings-button');
  if (!panel) return;

  const width = window.innerWidth < 600 ? '100%' : '400px';
  panel.style.width = width;

  if (gearBtn) {
    gearBtn.style.opacity = '0';
    gearBtn.style.pointerEvents = 'none';
    gearBtn.style.transform = 'rotate(90deg) scale(0.5)';
  }
}

export function closeSettings(): void {
  const panel = document.getElementById('settings-panel');
  const gearBtn = document.getElementById('settings-button');
  if (!panel) return;

  panel.style.width = '0';
  if (gearBtn) {
    gearBtn.style.opacity = '1';
    gearBtn.style.pointerEvents = 'auto';
    gearBtn.style.transform = 'rotate(0deg) scale(1)';
  }
}

export function resetSettings(): void {
  if (!confirm('确定要重置所有系统设置吗？')) return;

  localStorage.clear();
  const settings = document.querySelectorAll('.setting');
  settings.forEach((elem) => {
    if (!isSettingElement(elem)) return;
    const def = elem.dataset.defaultValue;
    if (elem.type === 'checkbox') {
      (elem as HTMLInputElement).checked = def === 'true';
    } else {
      elem.value = def ?? '';
    }
  });
  console.log('设置已重置为系统默认');
}
