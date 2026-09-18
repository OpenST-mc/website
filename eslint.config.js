// Minimal lint gate: no-undef focus only. Keep thin on purpose.
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
  ResizeObserver: 'readonly'
}

// Legacy classic-script sharing (vendor libs + cross-file functions loaded
// via plain <script> tags, no modules). Grandfathered: no new entries.
const vendorGlobals = {
  Vue: 'readonly',
  marked: 'readonly',
  DOMPurify: 'readonly',
  JSZip: 'readonly',
  pako: 'readonly',
  deepslate: 'readonly',
  assets: 'readonly',
  glMatrix: 'readonly',
  OPAQUE_BLOCKS: 'readonly',
  NON_SELF_CULLING: 'readonly',
  TRANSPARENT_BLOCKS: 'readonly',
  deepslateResources: 'writable',
  hideLoading: 'readonly',
  loadAndProcessFile: 'readonly',
  loadDeepslateResources: 'readonly',
  openSettings: 'readonly',
  closeSettings: 'readonly',
  readLitematicFromNBTData: 'readonly',
  structuresFromLitematic: 'readonly',
  iterateRegionBlocks: 'readonly',
  getMaterialList: 'readonly'
}

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
  crypto: 'readonly'
}

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
  removeEventListener: 'readonly'
}

export default [
  {
    ignores: ['vendor/', 'dist/', 'node_modules/', 'css/*Output.css', '**/*.min.js', 'resource/assets.js']
  },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...browserGlobals, ...nodeGlobals, ...workerGlobals, ...vendorGlobals }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-empty': 'warn',
      eqeqeq: ['warn', 'smart']
    }
  }
]
