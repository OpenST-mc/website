import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Browser globals (new TS/TSX app code).
const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  console: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  CustomEvent: 'readonly',
  Event: 'readonly',
  HTMLElement: 'readonly',
  HTMLCanvasElement: 'readonly',
  Image: 'readonly',
  Audio: 'readonly',
  Worker: 'readonly',
  WebSocket: 'readonly',
  indexedDB: 'readonly',
  crypto: 'readonly',
  btoa: 'readonly',
  atob: 'readonly',
  prompt: 'readonly',
  AbortController: 'readonly',
  IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly',
};

const nodeGlobals = {
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  module: 'readonly',
  require: 'readonly',
  exports: 'readonly',
  global: 'readonly',
  console: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  clearImmediate: 'readonly',
  fetch: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  crypto: 'readonly',
};

const workerGlobals = {
  Response: 'readonly',
  Request: 'readonly',
  Headers: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  ReadableStream: 'readonly',
  WritableStream: 'readonly',
  TransformStream: 'readonly',
  caches: 'readonly',
  clients: 'readonly',
  addEventListener: 'readonly',
  removeEventListener: 'readonly',
};

// 行宽：代码 120（与 Prettier 对齐），注释 70；不可拆分的字符串/URL 豁免。
const styleRules = {
  'max-len': [
    'error',
    {
      code: 120,
      comments: 70,
      tabWidth: 2,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true,
      ignoreTrailingComments: true,
    },
  ],
  'max-lines': ['error', { max: 800, skipBlankLines: true, skipComments: true }],
};

export default tseslint.config(
  {
    ignores: [
      'vendor/',
      'dist/',
      'node_modules/',
      'css/*Output.css',
      '**/*.min.js',
      '**/resource/assets.js',
      'apps/extra/litematic-preview/resource/',
      'workers/dist/',
      '.wrangler/',
      'content/',
      'archive/',
      '.docs/',
      '.agents/',
      'temp-opencode/',
      'test-results/',
      'playwright-report/',
      'blob-report/',
    ],
  },
  // TypeScript / TSX application code.
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...browserGlobals, ...nodeGlobals },
    },
    rules: {
      ...styleRules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        {
          selector: 'parameter',
          format: ['camelCase', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
        // 外部数据字段（info.json / NBT / OAuth）沿用源格式。
        { selector: 'property', format: null },
        { selector: 'objectLiteralProperty', format: null },
        { selector: 'typeProperty', format: null },
        { selector: 'import', format: null },
      ],
    },
  },
  // React Hooks rules for JSX/TSX.
  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Classic / Node JS（构建脚本、api functions、Worker、insights 打包源码、
  // litematic 运行时资源）：同一套最小门。
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...browserGlobals, ...nodeGlobals, ...workerGlobals },
    },
    rules: {
      ...styleRules,
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-empty': 'warn',
      eqeqeq: ['warn', 'smart'],
    },
  },
);
