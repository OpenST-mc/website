// 加载遮罩显隐（供 main / ui-init 共用，避免循环依赖）。
export function showLoading(): void {
  document.getElementById('loading-overlay')?.classList.remove('hidden');
}

export function hideLoading(): void {
  document.getElementById('loading-overlay')?.classList.add('hidden');
}
