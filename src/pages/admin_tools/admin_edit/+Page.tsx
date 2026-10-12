import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { TAG_CONFIG } from '../../../lib/config';
import { deleteArchive, replaceLitematic, updateInfo, updatePreview } from '../../../lib/api';
import { fetchJson, HttpError } from '../../../lib/http';
import { parseDatabase, sanitizeQueryParam } from '../../../lib/schema';
import { notify } from '../../../lib/notify';
import { ARCHIVE_EXTENSIONS, IMAGE_EXTENSIONS, validateUploadFile } from '../../../lib/upload';
import { useSession } from '../../../hooks/useSession';
import { AuthButton } from '../../../components/AuthButton';
import { StatusPanel } from '../../../components/StatusPanel';
import './admin_edit.css';

interface EditForm {
  id: string;
  sub_id: string;
  name: string;
  author: string;
  tags: string[];
  description: string;
  preview: string;
  filename: string;
  folder: string;
  submitDate: string;
}

const EMPTY_FORM: EditForm = {
  id: '',
  sub_id: '',
  name: '',
  author: '',
  tags: [],
  description: '',
  preview: '',
  filename: '',
  folder: '',
  submitDate: '',
};

function stripPath(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s.includes('/') ? (s.split('/').pop() ?? '') : s;
}

function previewUrl(preview: string): string {
  if (!preview) return '';
  if (preview.startsWith('data:image')) return preview;
  const rawPath = decodeURIComponent(preview);
  const safePath = rawPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')
    .replace(/^\/+/, '');
  return `https://cdn.jsdelivr.net/gh/OpenST-mc/archive@main/${safePath}`;
}

export default function Page() {
  const { isAdmin, status } = useSession();
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPreview, setIsUploadingPreview] = useState(false);
  const [isUploadingLitematic, setIsUploadingLitematic] = useState(false);
  const previewInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const folder = sanitizeQueryParam(new URLSearchParams(window.location.search).get('folder'));
    if (!folder) {
      notify('error', '缺少或非法的 folder 参数');
      return;
    }
    const controller = new AbortController();
    fetchJson<unknown>('/archive/data/database.json', { signal: controller.signal, timeoutMs: 15000, retries: 1 })
      .then(({ data, response }) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const item = parseDatabase(data).find((entry) => entry.id === folder);
        if (!item) {
          notify('error', `在数据库中未找到该稿件：${folder}`);
          return;
        }
        setForm({ ...EMPTY_FORM, ...item, folder: item.id });
        console.log('加载成功，当前操作目录:', item.id);
      })
      .catch((error: unknown) => {
        if (error instanceof HttpError && error.code === 'aborted') return;
        console.error('[admin_edit] database load failed', error);
        notify('error', '稿件数据加载失败，请刷新重试');
      });
    return () => controller.abort();
  }, []);

  const previewHtml = useMemo(() => {
    try {
      return DOMPurify.sanitize(String(marked.parse(form.description || '_等待输入内容..._', { breaks: true, gfm: true })));
    } catch {
      return '';
    }
  }, [form.description]);

  const currentPreviewUrl = useMemo(() => previewUrl(form.preview), [form.preview]);

  const toggleTag = (tag: string) =>
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));

  const handlePreviewChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const invalid = validateUploadFile(file, { extensions: IMAGE_EXTENSIONS, label: '预览图' });
      if (invalid) {
        notify('error', invalid);
        e.target.value = '';
        return;
      }
      const folder = form.folder;
      console.log('当前稿件文件夹:', folder);
      setIsUploadingPreview(true);
      try {
        const res = await updatePreview(file, folder);
        if (res.ok) {
          const newName = (res.json as { newName?: string } | undefined)?.newName;
          if (newName) setForm((prev) => ({ ...prev, preview: newName }));
          notify('success', '预览图更新成功');
        } else if (res.status === 401) {
          notify('error', '认证失效，请重新登录');
        } else {
          notify('error', `预览图上传失败（HTTP ${res.status}）`);
        }
      } catch (err) {
        console.error(err);
        notify('error', '网络错误，预览图未更新');
      } finally {
        setIsUploadingPreview(false);
        e.target.value = '';
      }
    },
    [form.folder],
  );

  const handleFileChange = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const invalid = validateUploadFile(file, { extensions: ARCHIVE_EXTENSIONS, label: '资源文件' });
      if (invalid) {
        notify('error', invalid);
        e.target.value = '';
        return;
      }
      if (!confirm(`确定要替换资源文件为: ${file.name}?`)) {
        e.target.value = '';
        return;
      }

      setIsUploadingLitematic(true);
      try {
        const res = await replaceLitematic(file, form.folder || form.id);
        if (res.ok) {
          setForm((prev) => ({ ...prev, filename: file.name }));
          notify('success', '资源文件已成功替换');
        } else {
          notify('error', `替换失败（HTTP ${res.status}）: ${res.text}`);
        }
      } catch (err) {
        console.error(err);
        notify('error', '网络错误，资源文件未替换');
      } finally {
        setIsUploadingLitematic(false);
        e.target.value = '';
      }
    },
    [form.folder, form.id],
  );

  const handleDeleteArchive = useCallback(async () => {
    const confirmID = prompt(`⚠️ 危险操作：此操作将永久删除该存档！\n请输入该存档 ID [ ${form.id} ] 以确认：`);
    if (confirmID !== form.id) {
      if (confirmID !== null) notify('error', 'ID 输入错误');
      return;
    }
    try {
      const res = await deleteArchive(form.id);
      if (res.ok) {
        notify('success', '稿件已彻底删除');
        window.location.href = '/archive/';
      } else {
        notify('error', `删除失败（HTTP ${res.status}）`);
      }
    } catch {
      notify('error', '请求错误，删除未执行');
    }
  }, [form.id]);

  const submitSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    const source = form;
    const finalInfoJson = {
      id: source.sub_id || source.id,
      name: source.name,
      author: source.author || '匿名',
      tags: Array.isArray(source.tags) ? source.tags : [],
      description: source.description,
      folder: source.folder || source.name.replace(/[#\\/:*?"<>|]/g, '_'),
      preview: stripPath(source.preview) || 'preview.png',
      filename: stripPath(source.filename),
      submitDate: source.submitDate || new Date().toISOString(),
    };
    try {
      const res = await updateInfo(source.id, finalInfoJson);
      if (res.status === 401) {
        notify('error', '认证失效，请先登录');
        window.location.href = '/archive/';
      } else if (res.ok) {
        notify('success', '信息修改成功！');
        window.location.href = '/archive/';
      } else {
        notify('error', `提交失败（HTTP ${res.status}）`);
      }
    } catch {
      notify('error', '网络错误，修改未提交');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, form]);

  useEffect(() => {
    console.log(
      '%c如果你并非网页开发人员，请勿在控制台内输入任何人传给你的脚本！\n%c在控制台输入脚本可能会让攻击者盗取你的 GitHub 访问令牌（Token），从而控制你的仓库或篡改数据。',
      'color: #333; font-size: 16px; font-weight: bold;',
      'color: red; font-size: 14px;',
    );
    return () => undefined;
  }, []);

  if (status === 'loading') {
    return (
      <div className="admin-edit-body p-6 md:p-12">
        <div className="max-w-[1400px] mx-auto">
          <StatusPanel variant="loading" title="检查登录状态..." />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-edit-body p-6 md:p-12">
        <div className="max-w-[1400px] mx-auto space-y-4 text-center">
          <h1 className="text-2xl font-bold text-white">需要管理员权限</h1>
          <p className="text-white/40 text-sm">请使用具备仓库权限的 GitHub 账号登录。</p>
          <AuthButton className="px-8 py-2.5 rounded-xl bg-[#40B5AD] text-black font-extrabold" />
        </div>
      </div>
    );
  }

  return (
    <div className="admin-edit-body p-6 md:p-12">
      <div id="app" className="max-w-[1400px] mx-auto">
        <header className="flex justify-between items-end mb-10 border-b border-white/5 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#40B5AD] tracking-tight">OpenST Editor</h1>
            <p className="text-white/30 text-sm mt-2 font-mono">Archive: {form.id}</p>
          </div>
          <div className="flex gap-4">
            <a
              href="/archive/index.html"
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-sm border border-white/10"
            >
              放弃返回
            </a>
            <button
              type="button"
              onClick={submitSave}
              disabled={isSaving}
              className="px-8 py-2.5 rounded-xl bg-[#40B5AD] text-black font-extrabold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#40B5AD]/20 disabled:opacity-50"
            >
              {isSaving ? '同步中...' : '提交修改'}
            </button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-widest">作品名称</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl focus:border-[#40B5AD] outline-none transition-all text-lg"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-widest">作者</label>
                <input
                  value={form.author}
                  onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl focus:border-[#40B5AD] outline-none transition-all text-lg"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-widest">
                标签分类 (二级/三级均可点选)
              </label>
              <div className="bg-white/5 p-6 rounded-3xl border border-white/10 space-y-8">
                {Object.entries(TAG_CONFIG).map(([mainCat, subConfig]) => (
                  <div key={mainCat} className="border-l-2 border-white/10 pl-4">
                    <h3 className="text-sm font-bold text-[#40B5AD] mb-4 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#40B5AD]" />
                      {mainCat}
                    </h3>

                    {Array.isArray(subConfig) ? (
                      <div className="flex flex-wrap gap-2">
                        {subConfig.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] transition-all border ${
                              form.tags.includes(tag)
                                ? 'bg-[#40B5AD] text-black border-[#40B5AD]'
                                : 'bg-white/5 text-white/40 border-white/10 hover:border-white/30'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {Object.entries(subConfig).map(([subCat, tags]) => (
                          <div key={subCat}>
                            <div className="mb-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleTag(subCat)}
                                className={`text-[10px] font-mono uppercase tracking-tighter px-2 py-0.5 border rounded transition-all ${
                                  form.tags.includes(subCat)
                                    ? 'text-[#40B5AD] border-[#40B5AD] bg-[#40B5AD]/10'
                                    : 'text-white/30 border-transparent hover:text-white/60'
                                }`}
                              >
                                {subCat}
                              </button>
                              {tags.length === 0 ? (
                                <span className="text-[9px] text-white/10 font-mono italic">EMPTY SLOT</span>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2 ml-2">
                              {tags.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => toggleTag(tag)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] transition-all border ${
                                    form.tags.includes(tag)
                                      ? 'bg-[#40B5AD] text-black border-[#40B5AD]'
                                      : 'bg-white/5 text-white/40 border-white/10 hover:border-white/30'
                                  }`}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-widest">Markdown 内容</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full min-h-[500px] bg-white/5 border border-white/10 p-6 rounded-3xl font-mono text-base outline-none focus:border-[#40B5AD] transition-all resize-none"
                placeholder="输入内容..."
              />
            </div>

            <div className="space-y-4 mt-8">
              <label className="text-xs font-bold text-red-500/60 ml-1 uppercase tracking-widest flex items-center gap-2">
                高级管理 / 危险操作
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 p-5 rounded-3xl flex items-center justify-between group relative overflow-hidden">
                  <div className="flex items-center gap-3 truncate">
                    <div className="p-2.5 rounded-xl bg-[#40B5AD]/10 text-[#40B5AD]">📄</div>
                    <div className="flex flex-col truncate">
                      <span className="text-xs font-bold text-white truncate">{form.filename}</span>
                      <span className="text-[9px] text-white/30 uppercase font-mono">Litematic File</span>
                    </div>
                  </div>
                  <input
                    type="file"
                    id="file-replace"
                    className="hidden"
                    accept=".litematic,.zip,.rar"
                    onChange={handleFileChange}
                  />
                  <label
                    htmlFor="file-replace"
                    className={`px-4 py-2 bg-[#40B5AD]/10 text-[#40B5AD] rounded-xl text-[11px] font-bold transition-all border border-[#40B5AD]/20 shrink-0 ${
                      isUploadingLitematic ? 'opacity-0' : 'cursor-pointer hover:bg-[#40B5AD] hover:text-black'
                    }`}
                  >
                    替换文件
                  </label>
                  {isUploadingLitematic ? (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#40B5AD] border-t-transparent mr-2" />
                      <span className="text-[10px] font-bold text-[#40B5AD]">同步中...</span>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={handleDeleteArchive}
                  className="bg-red-500/5 border border-red-500/20 hover:bg-red-500 hover:text-white text-red-500 p-5 rounded-3xl transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-red-500/10 group-hover:bg-white/20">🗑️</div>
                    <span className="text-xs font-black uppercase tracking-widest">彻底删除此稿件</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="sticky top-6">
            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-2xl group">
              <div className="px-6 py-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                <span className="text-xs font-bold text-white/20 uppercase tracking-[0.2em]">
                  Live Preview / 点击图片更换
                </span>
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20" />
                </div>
              </div>

              <div
                className="relative aspect-[16/9] bg-black/40 cursor-pointer overflow-hidden"
                onClick={() => previewInputRef.current?.click()}
              >
                {currentPreviewUrl ? (
                  <img
                    src={currentPreviewUrl}
                    className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ${
                      isUploadingPreview ? 'opacity-30' : ''
                    }`}
                    alt={form.name ? `${form.name} 预览图` : '预览图'}
                  />
                ) : null}

                {isUploadingPreview ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#40B5AD] border-t-transparent" />
                  </div>
                ) : null}

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                  <span className="text-xs font-bold text-white">更换预览图</span>
                </div>
                <input
                  type="file"
                  ref={previewInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handlePreviewChange}
                />
              </div>

              <div className="p-8 md:p-10 markdown-body min-h-[400px]">
                <h1>{form.name || 'Untitled'}</h1>
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
