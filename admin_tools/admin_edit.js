// 管理员稿件编辑器
import { TAG_CONFIG } from '../archive/scripts/config.js';
const { createApp } = Vue;

createApp({
    data() {
        return {
            isSaving: false,
            isUploadingPreview: false,
            isUploadingLitematic: false,
            TAG_CONFIG,
            editForm: {
                id: '',
                sub_id: '',
                name: '',
                author: '',
                tags: [],
                description: '',
                preview: '',
                filename: '',
                folder: '',
                submitDate: ''
            },
            WORKER_URL: 'https://api.openstmc.com'
        }
    },
    computed: {
        previewHtml() {
            marked.setOptions({ breaks: true, gfm: true });
            const rawHtml = marked.parse(this.editForm.description || '_等待输入内容..._');
            // DOMPurify 净化，防止存储型 XSS
            return DOMPurify.sanitize(rawHtml);
        },
        currentPreviewUrl() {
            if (!this.editForm.preview) return '';
            if (this.editForm.preview.startsWith('data:image')) return this.editForm.preview;
            const rawPath = decodeURIComponent(this.editForm.preview);
            const safePath = rawPath.split('/').map(s => encodeURIComponent(s)).join('/');
            return `https://cdn.jsdmirror.com/gh/OpenST-mc/website@main/${safePath}`;
        }
    },
    async mounted() {
        const folder = new URLSearchParams(window.location.search).get('folder');
        if (!folder) return;
        try {
            const res = await fetch('../data/database.json');
            const database = await res.json();
            const item = database.find(i => i.id === folder);
            if (item) this.editForm = JSON.parse(JSON.stringify(item));
            if (!this.editForm.folder) {
                this.editForm.folder = item.folder || item.id || folderName;
                console.log("✅ 加载成功，当前操作目录:", this.editForm.folder);
            } else {
                console.warn("⚠️ 在数据库中未找到该稿件:", folderName);
            }
        } catch (e) { console.error("Load failed", e); }
    },
    methods: {
        toggleTag(tag) {
            const idx = this.editForm.tags.indexOf(tag);
            idx > -1 ? this.editForm.tags.splice(idx, 1) : this.editForm.tags.push(tag);
        },

        // 更换预览图
        async handlePreviewChange(e) {
            console.log("当前稿件文件夹:", this.editForm.folder);
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => { this.localPreviewUrl = ev.target.result; };
            reader.readAsDataURL(file);
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', this.editForm.folder);
            this.isUploadingPreview = true;
            try {
                const res = await fetch(`${this.WORKER_URL}/api/admin/update-preview`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
                if (res.ok) {
                    const data = await res.json();
                    this.editForm.preview = data.newName;
                    alert("✅ 预览图更新成功");
                } else {
                    alert("❌ 上传失败，请检查登录状态");
                }
            } catch (e) {
                console.error(e);
                alert("❌ 网络错误");
            } finally {
                this.isUploadingPreview = false;
            }
        },

        // 文件更换逻辑
        async handleFileChange(e) {
            const file = e.target.files[0];
            if (!file) return;
            const allowedExts = ['.litematic', '.zip', '.rar',];
            const isAllowed = allowedExts.some(ext => file.name.toLowerCase().endsWith(ext));
            if (!isAllowed) {
                return alert(`目前只支持以下格式: ${allowedExts.join(', ')}`);
            }
            if (!confirm(`确定要替换资源文件为: ${file.name}?`)) return;

            this.isUploadingFile = true;
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('folder', this.editForm.id); // 这里的 id 就是文件夹名

                const res = await fetch(`${this.WORKER_URL}/api/admin/replace-litematic`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });

                if (res.ok) {
                    this.editForm.filename = file.name;
                    alert("✅ 资源文件已成功替换");
                } else {
                    const error = await res.text();
                    alert(`❌ 替换失败: ${error}`);
                }
            } catch (e) {
                console.error(e);
                alert("❌ 网络错误，请检查控制台");
            } finally {
                this.isUploadingFile = false;
            }
        },

        // 删除稿件
        async handleDeleteArchive() {
            const confirmID = prompt(`⚠️ 危险操作：此操作将永久删除该存档！\n请输入该存档 ID [ ${this.editForm.id} ] 以确认：`);
            if (confirmID !== this.editForm.id) {
                if (confirmID !== null) alert("❌ ID 输入错误");
                return;
            }
            try {
                const res = await fetch(`${this.WORKER_URL}/api/admin/delete-archive`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ folder: this.editForm.id })
                });
                if (res.ok) {
                    alert("🗑️ 稿件已彻底删除");
                    window.location.href = '../archive.html';
                } else alert("❌ 删除失败");
            } catch (e) { alert("❌ 请求错误"); }
        },

        // 原有保存逻辑
        async submitSave() {
            if (this.isSaving) return;

            this.isSaving = true;
            const source = this.editForm;
            const stripPath = (s) => (s && typeof s === 'string' && s.includes('/')) ? s.split('/').pop() : s;

            const finalInfoJson = {
                "id": source.sub_id || source.id,
                "name": source.name,
                "author": source.author || '匿名',
                "tags": Array.isArray(source.tags) ? source.tags : [],
                "description": source.description,
                "folder": source.folder || source.name.replace(/[#\\/:*?"<>|]/g, '_'),
                "preview": stripPath(source.preview) || "preview.png",
                "filename": stripPath(source.filename),
                "submitDate": source.submitDate || new Date().toISOString()
            };

            try {
                const res = await fetch(`${this.WORKER_URL}/api/admin/update-info`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ folder: source.id, newInfo: finalInfoJson })
                });
                if (res.status === 401) {
                    alert("❌ 认证失效，请先登录");
                    window.location.href = '../archive/index.html';
                } else if (res.ok) {
                    alert("✅ 信息修改成功！");
                    window.location.href = '../archive.html';
                } else alert("❌ 提交失败");
            } catch (e) { alert("❌ 网络错误"); }
            finally { this.isSaving = false; }
        }
    }
}).mount('#app');

console.log(
    "%c如果你并非网页开发人员，请勿在控制台内输入任何人传给你的脚本！\n%c在控制台输入脚本可能会让攻击者盗取你的 GitHub 访问令牌（Token），从而控制你的仓库或篡改数据。",
    "color: #333; font-size: 16px; font-weight: bold;",
    "color: red; font-size: 14px;"
);
