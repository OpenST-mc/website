// 管理员打包工具：生成投稿压缩包
import { TAG_CONFIG } from '../archive/scripts/config.js';
const { createApp } = Vue;
createApp({
    data() {
        return {
            config: TAG_CONFIG,
            previewFile: null,
            litematicFile: null,
            isProcessing: false,
            form: {
                name: '',
                author: '',
                tags: [],
                desc: '### 🚀 机器概览\n- **核心功能**: \n- **适用版本**: Java 1.20.x\n\n### 📖 使用说明\n1. \n\n> 提示：'
            }
        }
    },
    computed: {
        isReady() { return this.form.name && this.previewFile && this.litematicFile; },
        previewHtml() {
            const rawHtml = marked.parse(this.form.desc || '');
            // DOMPurify 净化，防止 XSS
            return DOMPurify.sanitize(rawHtml);
        },
        flatConfig() {
            const res = {};
            for (let k in this.config) {
                res[k] = Array.isArray(this.config[k]) ? this.config[k] : Object.values(this.config[k]).flat();
            }
            return res;
        }
    },
    methods: {
        toggleTag(tag) {
            const i = this.form.tags.indexOf(tag);
            i > -1 ? this.form.tags.splice(i, 1) : this.form.tags.push(tag);
        },
        async generateZip() {
            if (this.isProcessing) return;
            this.isProcessing = true;
            try {
                const zip = new JSZip();
                const now = new Date();
                const previewExt = this.previewFile.name.split('.').pop().toLowerCase();
                const previewName = `preview.${previewExt}`;
                const zipFileName = `${this.form.name.replace(/[\\/:*?"<>|]/g, '_')}.zip`;

                const infoJson = {
                    "id": `sub-${now.getTime()}`,
                    "name": this.form.name,
                    "author": this.form.author || '未知',
                    "tags": this.form.tags,
                    "description": this.form.desc,
                    "folder": this.form.name,
                    "preview": previewName,
                    "filename": this.litematicFile.name,
                    "submitDate": now.toISOString()
                };

                const folder = zip.folder(this.form.name);
                folder.file("info.json", JSON.stringify(infoJson, null, 4));
                folder.file(previewName, this.previewFile);
                folder.file(this.litematicFile.name, this.litematicFile);

                const blob = await zip.generateAsync({type: "blob"});
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = zipFileName;
                a.click();

                setTimeout(() => {
                    window.URL.revokeObjectURL(url);
                    this.resetEverything();
                    this.isProcessing = false;
                }, 500);
            } catch (e) {
                alert("Error: " + e.message);
                this.isProcessing = false;
            }
        },
        resetEverything() {
            this.form = { name: '', author: '', tags: [], desc: '### 🚀 机器概览\n- **核心功能**: \n- **适用版本**: Java 1.20.x\n\n### 📖 使用说明\n1. \n\n> 提示：' };
            this.previewFile = null;
            this.litematicFile = null;
            if(this.$refs.previewInput) this.$refs.previewInput.value = '';
            if(this.$refs.litematicInput) this.$refs.litematicInput.value = '';
        }
    }
}).mount('#app');
