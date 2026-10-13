// vendor 经典脚本在运行期注入的全局（deepslate/gl-matrix UMD + resource/*.js）。
// 类型来自 npm 包自带的声明（仅类型引用，不参与打包）。
import type * as Deepslate from 'deepslate';
import type * as GlMatrix from 'gl-matrix';
import type { LitematicAssets } from './types';

declare global {
  const deepslate: typeof Deepslate;
  const glMatrix: typeof GlMatrix;
  const assets: LitematicAssets;
  const OPAQUE_BLOCKS: ReadonlySet<string>;
  const NON_SELF_CULLING: ReadonlySet<string>;
  const TRANSPARENT_BLOCKS: ReadonlySet<string>;
}

export {};
