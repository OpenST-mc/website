import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { parseNbtRoot, type NbtRoot } from '../src/lib/litematic/nbt';
import { gzipNbt, inflateNbt } from '../src/lib/litematic/convert';

// M5 extra 工具对等：/Extra-Function/*。

test('converter page shell is server-rendered', async ({ page }) => {
  await page.goto('/Extra-Function/litematic-converter');
  await expect(page).toHaveTitle('OpenST | Litematica Converter');
  await expect(page.getByRole('heading', { name: 'Litematica Converter' })).toBeVisible();
  await expect(page.getByRole('button', { name: '开始转换' })).toBeVisible();
});

test('converter converts an uploaded litematic and downloads the result', async ({ page }) => {
  await page.goto('/Extra-Function/litematic-converter');
  await page.waitForLoadState('networkidle');

  const root: NbtRoot = {
    name: '',
    type: 'compound',
    value: {
      MinecraftDataVersion: { type: 'int', value: 4000 },
      Version: { type: 'int', value: 7 },
    },
  };
  const buffer = Buffer.from(gzipNbt(root));

  const downloadPromise = page.waitForEvent('download');
  await page.setInputFiles('#file', {
    name: 'demo.litematic',
    mimeType: 'application/octet-stream',
    buffer,
  });
  await page.getByRole('button', { name: '开始转换' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('demo.litematic');

  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const converted = parseNbtRoot(inflateNbt(new Uint8Array(fs.readFileSync(downloadPath as string))));
  expect(converted.value['MinecraftDataVersion']?.value).toBe(3953);
  expect(converted.value['Version']?.value).toBe(7);
});

test('preview page shell is server-rendered and boots the viewer engine', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/Extra-Function/litematic-preview');
  await expect(page).toHaveTitle('OpenST | Litematic Viewer');
  await expect(page.getByText('投影预览系统')).toBeVisible();
  await expect(page.getByText('选择/拖拽.litematic文件')).toBeVisible();
  await expect(page.locator('#viewer canvas')).toBeAttached({ timeout: 15_000 });
  expect(pageErrors).toEqual([]);
});

test('preview decodes an uploaded litematic into the material list', async ({ page }) => {
  await page.goto('/Extra-Function/litematic-preview');
  await expect(page.locator('#viewer canvas')).toBeAttached({ timeout: 15_000 });

  // 2x1x2 区域，palette=[air, stone, oak_planks]，nbits=2，块序列 [1, 2, 2, 0]。
  const root: NbtRoot = {
    name: '',
    type: 'compound',
    value: {
      MinecraftDataVersion: { type: 'int', value: 3953 },
      Version: { type: 'int', value: 7 },
      Regions: {
        type: 'compound',
        value: {
          r1: {
            type: 'compound',
            value: {
              Size: {
                type: 'compound',
                value: { x: { type: 'int', value: 2 }, y: { type: 'int', value: 1 }, z: { type: 'int', value: 2 } },
              },
              Position: {
                type: 'compound',
                value: { x: { type: 'int', value: 0 }, y: { type: 'int', value: 0 }, z: { type: 'int', value: 0 } },
              },
              BlockStatePalette: {
                type: 'list',
                value: {
                  type: 'compound',
                  value: [
                    { Name: { type: 'string', value: 'minecraft:air' } },
                    { Name: { type: 'string', value: 'minecraft:stone' } },
                    { Name: { type: 'string', value: 'minecraft:oak_planks' } },
                  ],
                },
              },
              BlockStates: { type: 'longArray', value: [41n] },
            },
          },
        },
      },
    },
  };

  await page.setInputFiles('#file-upload', {
    name: 'demo.litematic',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(gzipNbt(root)),
  });

  const materialList = page.locator('#settings-material-list');
  await expect(materialList).toContainText('Material List (3 blocks)');
  await expect(materialList).toContainText('stone');
  await expect(materialList).toContainText('oak_planks');
  await expect(page.locator('#cancel-preview-btn')).not.toHaveClass(/hidden/);
});

test('preview settings panel opens/closes and mirror setting persists', async ({ page }) => {
  await page.goto('/Extra-Function/litematic-preview');
  await expect(page.locator('#viewer canvas')).toBeAttached({ timeout: 15_000 });

  const panel = page.locator('#settings-panel');
  await page.locator('#settings-button').click();
  await expect(panel).toHaveCSS('width', '400px');

  await page.locator('#mirror-toggle').check({ force: true });
  expect(await page.evaluate(() => localStorage.getItem('mirrorMode'))).toBe('true');

  await page.locator('#settings-close').click();
  // 折叠后仅剩 1px 左边框（border-box），轮询确认动画收敛。
  await expect
    .poll(() => panel.evaluate((el) => parseFloat(getComputedStyle(el).width)))
    .toBeLessThan(2);
});
