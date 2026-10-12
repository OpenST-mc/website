import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import JSZip from 'jszip';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { DEFAULT_DESC, buildInfoJson, flattenTagConfig, sanitizeZipName } from '../../lib/packer';
import { notify } from '../../lib/notify';
import { IMAGE_EXTENSIONS, validateUploadFile } from '../../lib/upload';
import '../../../css/ArchiveInput.css';
import './admin_tools.css';

const PACKER_ARCHIVE_EXTENSIONS = ['.litematic'];

// 管理员打包工具：生成投稿压缩包（zip 与 info.json 语义对齐旧实现）。
export default function Page() {
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [litematicFile, setLitematicFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [desc, setDesc] = useState(DEFAULT_DESC);
  const [isProcessing, setIsProcessing] = useState(false);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const litematicInputRef = useRef<HTMLInputElement>(null);

  const flatConfig = useMemo(() => flattenTagConfig(), []);
  const previewHtml = useMemo(() => {
    if (!desc) return '';
    try {
      return DOMPurify.sanitize(String(marked.parse(desc)));
    } catch {
      return '';
    }
  }, [desc]);
  const isReady = Boolean(name && previewFile && litematicFile);

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const handlePreviewFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const invalid = validateUploadFile(file, { extensions: IMAGE_EXTENSIONS, label: '预览图' });
      if (invalid) {
        notify('error', invalid);
        e.target.value = '';
        setPreviewFile(null);
        return;
      }
    }
    setPreviewFile(file);
  };

  const handleArchiveFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      const invalid = validateUploadFile(file, { extensions: PACKER_ARCHIVE_EXTENSIONS, label: '存档文件' });
      if (invalid) {
        notify('error', invalid);
        e.target.value = '';
        setLitematicFile(null);
        return;
      }
    }
    setLitematicFile(file);
  };

  const resetEverything = () => {
    setName('');
    setAuthor('');
    setTags([]);
    setDesc(DEFAULT_DESC);
    setPreviewFile(null);
    setLitematicFile(null);
    if (previewInputRef.current) previewInputRef.current.value = '';
    if (litematicInputRef.current) litematicInputRef.current.value = '';
  };

  const generateZip = async () => {
    if (isProcessing || !previewFile || !litematicFile || !name) return;
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      const now = new Date();
      const infoJson = buildInfoJson(
        { name, author, tags, desc, previewFileName: previewFile.name, litematicFileName: litematicFile.name },
        now,
      );
      const folder = zip.folder(name);
      if (!folder) throw new Error('zip folder failed');
      folder.file('info.json', JSON.stringify(infoJson, null, 4));
      folder.file(infoJson.preview, previewFile);
      folder.file(litematicFile.name, litematicFile);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizeZipName(name)}.zip`;
      a.click();

      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
        resetEverything();
        setIsProcessing(false);
      }, 500);
    } catch (e) {
      notify('error', '打包失败: ' + (e as Error).message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-[#0f172a] text-slate-200 p-4 md:p-8 admin-tools-page">
      <div
        id="app"
        className={`max-w-6xl mx-auto transition-all ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#40B5AD] tracking-tighter italic">ADMIN PACKER PRO</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Responsive Factory Mode</p>
          </div>
          {isProcessing ? (
            <div className="flex items-center gap-2 text-[#40B5AD] bg-[#40B5AD]/10 px-4 py-2 rounded-full border border-[#40B5AD]/20">
              <span className="animate-spin">⚙️</span>
              <span className="text-xs font-bold uppercase">Packing &amp; Downloading...</span>
            </div>
          ) : null}
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
          <div className="space-y-6 order-1">
            <div className="grid grid-cols-2 gap-4">
              <label className="border-2 border-dashed border-slate-700 p-4 rounded-2xl text-center cursor-pointer hover:border-[#40B5AD]/50 hover:bg-[#40B5AD]/5 transition-all peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[#40B5AD]">
                <span className="block text-2xl mb-1">🖼️</span>
                <p className={`text-[10px] font-bold uppercase truncate px-2 ${previewFile ? 'text-[#40B5AD]' : 'text-slate-500'}`}>
                  {previewFile ? previewFile.name : 'Image'}
                </p>
                <input
                  type="file"
                  ref={previewInputRef}
                  onChange={handlePreviewFile}
                  className="sr-only peer"
                  accept="image/*"
                />
              </label>
              <label className="border-2 border-dashed border-slate-700 p-4 rounded-2xl text-center cursor-pointer hover:border-[#40B5AD]/50 hover:bg-[#40B5AD]/5 transition-all peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[#40B5AD]">
                <span className="block text-2xl mb-1">📦</span>
                <p
                  className={`text-[10px] font-bold uppercase truncate px-2 ${litematicFile ? 'text-[#40B5AD]' : 'text-slate-500'}`}
                >
                  {litematicFile ? litematicFile.name : 'Schem'}
                </p>
                <input
                  type="file"
                  ref={litematicInputRef}
                  onChange={handleArchiveFile}
                  className="sr-only peer"
                  accept=".litematic"
                />
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="作品名称"
                className="flex-1 bg-black/40 border border-white/10 p-3 rounded-xl text-white focus:border-[#40B5AD] outline-none text-sm"
              />
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="作者"
                className="sm:w-1/3 bg-black/40 border border-white/10 p-3 rounded-xl text-white focus:border-[#40B5AD] outline-none text-sm"
              />
            </div>

            <div className="space-y-2">
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Markdown 简介..."
                className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white h-48 lg:h-64 resize-none outline-none focus:border-[#40B5AD] font-mono text-sm"
              />
            </div>

            <div className="space-y-4 bg-black/20 p-4 rounded-2xl border border-white/5">
              {Object.entries(flatConfig).map(([cat, catTags]) => (
                <div key={cat} className="space-y-2">
                  <p className="text-[9px] text-[#40B5AD]/50 font-bold uppercase tracking-widest">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {catTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all uppercase tracking-tight ${
                          tags.includes(tag)
                            ? 'bg-[#40B5AD] text-slate-900 border-[#40B5AD]'
                            : 'bg-white/5 text-slate-500 border-white/10'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={generateZip}
              disabled={!isReady || isProcessing}
              className="w-full bg-[#40B5AD] hover:brightness-110 disabled:opacity-10 text-slate-900 font-black py-5 rounded-2xl transition-all shadow-xl shadow-[#40B5AD]/10 active:scale-95 text-sm uppercase tracking-widest"
            >
              {isProcessing ? 'Working...' : 'Pack & Download'}
            </button>
          </div>

          <div className="flex flex-col order-2 lg:border-l lg:border-white/5 lg:pl-12">
            <p className="text-[10px] text-[#40B5AD] font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#40B5AD]" />
              Live Preview
            </p>
            <div className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl overflow-y-auto markdown-body min-h-[200px] max-h-[400px] lg:max-h-full lg:flex-grow">
              {desc ? (
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <div className="text-slate-600 text-xs italic">No description to preview...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
