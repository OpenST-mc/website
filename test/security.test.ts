// 安全负例：litematic 预览的材质名来自用户文件，必须以文本渲染（防 DOM XSS）。
import { describe, it, expect, beforeEach } from 'vitest';
import { createMaterialsList } from '../src/pages/litematic-preview/main.ts';

describe('createMaterialsList', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="settings-material-list"></div>';
  });

  it('renders hostile material names as text, never as HTML', () => {
    createMaterialsList({ '<img src=x onerror="window.__xss=1">': 3, 'minecraft:stone': 2 });

    const list = document.getElementById('settings-material-list');
    expect(list).not.toBeNull();
    expect(list!.querySelector('img')).toBeNull();
    expect(list!.querySelector('script')).toBeNull();
    expect(list!.textContent).toContain('<img src=x onerror="window.__xss=1">');
    expect(list!.textContent).toContain('stone');
  });
});
