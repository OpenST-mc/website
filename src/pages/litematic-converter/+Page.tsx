import { useRef, type FormEvent } from 'react';
import {
  convertLitematic,
  gzipNbt,
  inflateNbt,
  requiresLegacyWarning,
} from '../../lib/litematic/convert';
import { parseNbtRoot } from '../../lib/litematic/nbt';
import { notify } from '../../lib/notify';
import '../../../css/ArchiveInput.css';
import './converter.css';

// Litematica Converter（/Extra-Function/litematic-converter）：
// 命令式转换核心在 src/lib/litematic/*；本组件只承接表单 UI 与文件下载。
const TARGET_VERSIONS = [
  ['3953', 'Minecraft 1.21 (3953)'],
  ['3463', 'Minecraft 1.20 (3463)'],
  ['3105', 'Minecraft 1.19 (3105)'],
  ['2860', 'Minecraft 1.18 (2860)'],
  ['2724', 'Minecraft 1.17 (2724)'],
  ['2586', 'Minecraft 1.16 (2586)'],
  ['2230', '1.15'],
  ['1952', '1.14'],
  ['1631', '1.13'],
  ['1343', '1.12'],
] as const;

function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

export default function Page() {
  const fileRef = useRef<HTMLInputElement>(null);
  const versionRef = useRef<HTMLSelectElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    const targetVersion = Number.parseInt(versionRef.current?.value ?? '', 10);
    if (!file || Number.isNaN(targetVersion)) return;

    try {
      const buffer = await file.arrayBuffer();
      const root = parseNbtRoot(inflateNbt(new Uint8Array(buffer)));

      console.log('Original NBT data:', JSON.stringify(root.value, bigIntReplacer, 2));

      if (requiresLegacyWarning(targetVersion)) {
        const userConfirmed = confirm(
          'Warning: Converting to versions 1.19 or lower may result in corrupted files or unconverted NBT tags. Do you wish to continue?'
        );
        if (!userConfirmed) {
          notify('info', '已取消转换');
          return;
        }
      }

      convertLitematic(root, targetVersion);

      console.log('Modified NBT data:', JSON.stringify(root.value, bigIntReplacer, 2));

      const outputBuffer = gzipNbt(root);
      const blob = new Blob([outputBuffer], { type: 'application/octet-stream' });
      console.log('Final output blob:', blob);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error processing the file:', error);
      notify('error', '文件处理失败，请检查控制台日志');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 relative overflow-hidden">
      <div className="soft-bg"></div>

      <div className="relative z-10 w-full max-w-2xl">
        <header className="mb-16 flex items-center gap-6">
          <h1 className="text-2xl font-bold tracking-tight text-[#f5f5f7]">Litematica Converter</h1>
          <div className="h-px flex-1 bg-white/5"></div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400 tracking-widest uppercase">
            <div className="breath-light"></div>
            Converter Active
          </div>
        </header>

        <main className="portal-card rounded-[2.5rem] p-10 md:p-16">
          <form id="uploadForm" className="space-y-8" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-400 ml-1" htmlFor="file">
                投影文件 (.litematic)
              </label>
              <input
                ref={fileRef}
                type="file"
                id="file"
                accept=".litematic"
                required
                className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#40B5AD]/10 file:text-[#40B5AD] hover:file:bg-[#40B5AD]/20 transition-all cursor-pointer custom-input p-4 rounded-2xl"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-400 ml-1" htmlFor="targetVersion">
                目标游戏版本
              </label>

              <div className="relative group">
                <select
                  ref={versionRef}
                  id="targetVersion"
                  defaultValue="3953"
                  className="w-full bg-white/5 border border-white/10 text-[#f5f5f7] p-4 pr-12 rounded-2xl appearance-none cursor-pointer focus:outline-none focus:border-[#40B5AD]/50 transition-all hover:bg-white/[0.08] text-sm font-medium"
                >
                  {TARGET_VERSIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>

                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 4L6 8L10 4" />
                  </svg>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 ml-1 tracking-wide uppercase italic" style={{ color: 'red' }}>
                注：转换到低版本时可能导致部分数据丢失！
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-[#40B5AD] hover:bg-[#47D1C8] text-black font-bold rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-[#40B5AD]/20"
            >
              开始转换
            </button>
          </form>
        </main>

        <footer className="mt-16 text-[9px] text-gray-400 tracking-[0.4em] uppercase text-center font-medium">
          <span>Universal Converter</span>
        </footer>
      </div>
    </div>
  );
}
