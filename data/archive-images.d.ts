export declare const PREVIEW_MAX: number;
export declare const THUMB_MAX: number;
export declare const DISPLAY_FILE: string;
export declare const THUMB_FILE: string;

export interface SourceImageMeta {
  format?: string;
  width?: number;
  height?: number;
}

export declare function needsDisplay(meta: SourceImageMeta): boolean;

export declare function ensureDerivatives(options: {
  dir: string;
  sourceFile: string;
}): Promise<{ display: string; thumb: string }>;
