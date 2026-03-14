// ui.js

export const NavBar = {
    // 增加 user 和 isAdmin 两个 props
    props: ['proxy', 'user', 'isAdmin'],
    template: `
    <nav class="h-16 bg-black/20 border-b border-white/5 flex items-center justify-between px-6 shrink-0 shadow-sm">
        <div class="flex items-center gap-4">
            <button @click="$emit('open-menu')" class="md:hidden p-2 -ml-2 text-gray-400 hover:text-brand transition-colors">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
            </button>
            <div class="font-bold tracking-tighter text-brand text-xl">
                MC-OPENST <span class="hidden sm:inline text-white/40 text-xs tracking-normal ml-1 font-normal uppercase">v4.0</span>
            </div>
        </div>

        <div class="flex items-center gap-6">
            <div class="flex items-center gap-3 border-l border-white/10 pl-6">
                <template v-if="user">
                    <div class="flex flex-col items-end hidden sm:flex">
                        <span class="text-xs font-bold text-white">{{ user.login }}</span>
                        <span v-if="isAdmin" class="text-[9px] bg-brand/20 text-brand px-1 rounded">STAFF</span>
                    </div>
                    <img :src="user.avatar_url" class="w-8 h-8 rounded-full border border-white/10">
                    <button @click="$emit('logout')" class="text-gray-500 hover:text-red-400 p-1">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke-width="2"/></svg>
                    </button>
                </template>
                <button v-else @click="$emit('login')" class="text-xs font-bold bg-white text-black px-4 py-1.5 rounded-full hover:bg-brand transition-colors">
                    GitHub 登录
                </button>
            </div>
        </div>
    </nav>`
};

export const SideBar = {
    props: ['groups', 'selected', 'search', 'categories'],
    data() {
        return {
            isOpen: false,
            expandedGroups: {}
        }
    },
    methods: {
        handleSubCatClick(cat, subCat, hasSubTags) {
            if (hasSubTags) {
                // 如果有子标签，切换展开状态并触发筛选
                this.expandedGroups[subCat] = !this.expandedGroups[subCat];
            }
            // 无论是否有子标签，都触发筛选信号
            this.$parent.toggleTag(cat, subCat);
        }
    },
    template: `
    <div class="shrink-0 flex text-[16px]">
        <div v-if="isOpen" @click="isOpen = false" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"></div>
        <aside :class="isOpen ? 'translate-x-0' : '-translate-x-full'"
               class="fixed inset-y-0 left-0 z-50 w-72 bg-[#191919] p-5 flex flex-col border-r border-white/5 transition-transform duration-300 md:relative md:translate-x-0 h-full shrink-0 shadow-2xl md:shadow-none">
            
            <div class="flex flex-col gap-3 mb-6 shrink-0">
                <div class="relative">
                    <input :value="search" @input="$emit('update:search', $event.target.value)" 
                           type="text" placeholder="搜索存档/作者/简介/标签..." 
                           class="w-full bg-black/40 rounded-lg px-4 py-2.5 text-base border border-white/5 focus:border-brand outline-none transition text-white pr-10">
                    <button v-if="search" @click="$emit('update:search', '')" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">✕</button>
                </div>
                <button v-if="search || Object.values(selected).some(v => v && v.length > 0)" 
                        @click="$emit('reset'); expandedGroups = {}"
                        class="w-full py-2 rounded-lg bg-brand/10 border border-brand/20 text-brand text-[13px] font-bold hover:bg-brand hover:text-white transition-all">
                    清除所有筛选
                </button>
            </div>

            <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-8">
                <div v-for="cat in categories" :key="cat" class="flex flex-col gap-2">
                    <span class="text-[11px] text-gray-600 font-bold uppercase tracking-[0.2em] mb-1">{{ cat }}</span>
                    <div class="flex flex-col text-[14px]">
                        
                        <template v-if="Array.isArray($parent.TAG_CONFIG[cat])">
                            <button v-for="tag in Array.from(groups[cat] || [])" 
                                    @click="$parent.toggleTag(cat, tag)"
                                    :class="selected[cat].includes(tag) ? 'text-brand font-bold bg-brand/5' : 'text-white/60 hover:text-white hover:bg-white/5'"
                                    class="text-left py-2 px-3 rounded-md transition-all flex items-center gap-3">
                                <span class="w-1.5 h-1.5 rounded-full" :class="selected[cat].includes(tag) ? 'bg-brand' : 'bg-white/10'"></span>
                                {{ tag }}
                            </button>
                        </template>

                        <template v-else-if="$parent.TAG_CONFIG[cat]">
                            <div v-for="(subTags, subCat) in $parent.TAG_CONFIG[cat]" :key="subCat" class="mb-1">
                                <button @click="handleSubCatClick(cat, subCat, subTags && subTags.length > 0)"
                                        :class="selected[cat].includes(subCat) ? 'bg-brand/10 border-l-2 border-brand text-brand' : 'text-white/80'"
                                        class="w-full text-left py-2 px-3 flex justify-between items-center group transition rounded-md hover:bg-white/5">
                                    <div class="flex items-center gap-3">
                                        <span v-if="!subTags || subTags.length === 0" 
                                              class="w-1.5 h-1.5 rounded-full" 
                                              :class="selected[cat].includes(subCat) ? 'bg-brand' : 'bg-white/10'"></span>
                                        <span class="font-medium">{{ subCat }}</span>
                                    </div>
                                    
                                    <span v-if="subTags && subTags.length > 0" 
                                          class="text-[10px] opacity-40 transition-transform duration-300" 
                                          :class="{'rotate-180': expandedGroups[subCat]}">▼</span>
                                </button>
                                
                                <div v-if="subTags && subTags.length > 0 && expandedGroups[subCat]" class="flex flex-col gap-1 ml-4 mt-1 mb-2 border-l border-white/5">
                                    <button v-for="tag in subTags" 
                                            v-show="groups[cat] && groups[cat].has(tag)"
                                            @click="$parent.toggleTag(cat, tag)"
                                            :class="selected[cat].includes(tag) ? 'text-brand font-bold bg-brand/5' : 'text-white/50 hover:text-white'"
                                            class="text-left text-[13px] py-1.5 px-4 rounded transition-all">
                                        {{ tag }}
                                    </button>
                                </div>
                            </div>
                        </template>

                    </div>
                </div>
            </div>
        </aside>
    </div>`
};

export const ArchiveCard = {
    props: ['item', 'isAdmin'], // 传入权限标识
    template: `
    <div class="group bg-panel rounded-[20px] overflow-hidden border border-white/5 hover:border-brand/40 active:scale-[0.98] transition-all duration-300 shadow-lg flex flex-col h-full relative">
        <button v-if="isAdmin" @click.stop="$emit('edit', item)" 
                class="absolute top-4 right-4 z-10 bg-brand text-black p-2 rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-width="2.5"/></svg>
        </button>

      <div class="aspect-[16/9] overflow-hidden relative cursor-pointer bg-black/20" @click="$emit('open', item)">
        <img v-lazy="$parent.getPreviewUrl(item)"
             class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
      </div>
        <div class="p-5 flex flex-col flex-1">
            <div class="cursor-pointer mb-3" @click="$emit('open', item)">
                <h3 class="font-bold text-base line-clamp-2 h-[2.8rem] text-gray-100 group-hover:text-brand transition-colors">{{ item.name }}</h3>
                <p class="text-xs text-gray-500 mt-1 truncate">by {{ item.author }}</p>
            </div>
            <div class="flex flex-wrap gap-1.5 mt-2">
                <span v-for="(tag, index) in item.tags" :key="index"
                      class="px-2 py-0.5 rounded-md text-[11px] font-bold border border-transparent truncate max-w-[90px]"
                      :class="index === 0 ? 'bg-brand/10 text-brand' : 'bg-white/5 text-gray-400'">
                    {{ tag }}
                </span>
            </div>
        </div>
    </div>`
};
export const DetailModal = {
    props: ['item', 'isAdmin'],
    computed: {
        renderedDescription() {
            if (!this.item?.description) return '<p class="italic opacity-50 text-gray-600">作者没留下任何简介，一定是大佬吧！</p>';
            // 使用 marked 解析 Markdown，支持换行和 GitHub 风格
            return marked.parse(this.item.description, { breaks: true, gfm: true });
        }
    },
    methods: {
        handleMdClick(e) {
            // 点击 Markdown 里的图片也可以触发放大查看
            if (e.target.tagName === 'IMG') {
                this.$root.handleImageZoom(e);
            }
        },
        copyPermalink(subId) {
            if (!subId) return;
            const url = `${window.location.origin}/archive.html?${subId}`;
            navigator.clipboard.writeText(url).then(() => {
                // 调用 main.js 中的提示方法（如弹窗通知）
                if (this.$root.handleCopyID) {
                    this.$root.handleCopyID(subId);
                }
            });
        }
    },
    template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6 detail-modal-container">
        <div class="absolute inset-0 bg-black/95 backdrop-blur-md" @click="$emit('close')"></div>
        
        <div class="bg-[#1a1a1a] w-full max-w-6xl md:rounded-[2rem] shadow-2xl overflow-hidden relative z-10 flex flex-col md:flex-row h-full md:h-auto md:max-h-[90vh] border border-white/5">
            
            <div v-if="isAdmin" class="absolute top-6 left-6 z-30 flex gap-2">
                <button @click="$emit('edit', item)" class="bg-brand/20 hover:bg-brand text-brand hover:text-black px-4 py-2 rounded-full text-xs font-bold transition-all border border-brand/20 backdrop-blur-md flex items-center gap-2">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" stroke-width="2"/></svg>
                    编辑稿件
                </button>
            </div>

            <button @click="$emit('close')" class="absolute top-6 right-6 z-30 bg-black/50 hover:bg-brand text-white w-10 h-10 rounded-full flex items-center justify-center transition-all group">
                <svg class="w-6 h-6 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-width="2.5"></path></svg>
            </button>

          <div class="flex flex-col md:flex-row w-full overflow-y-auto md:overflow-visible">
            <div class="w-full md:w-3/5 bg-black/20 flex items-center justify-center border-b md:border-b-0 md:border-r border-white/5 p-4 md:p-10 md:sticky md:top-0 h-auto md:h-[90vh]">
              <img :src="$parent.getPreviewUrl(item)"
                   @click.stop="$root.handleImageZoom($event)"
                   class="w-full h-auto md:max-h-full object-contain rounded-xl shadow-2xl cursor-zoom-in">
            </div>

                <div class="w-full md:w-2/5 p-8 md:p-10 flex flex-col gap-8 bg-[#1a1a1a] md:overflow-y-auto md:h-[90vh] custom-scrollbar text-gray-400">
                    <div>
                        <div class="text-brand text-xs font-bold tracking-[0.2em] uppercase mb-2">Archive Detail</div>
                        <h2 class="text-3xl font-bold text-white leading-tight">{{ item.name }}</h2>
                        
                        <div class="flex flex-col gap-3 mt-4">
                             <p class="text-lg text-gray-200">by {{ item.author }}</p>
                             
                             <div @click="copyPermalink(item.sub_id)" 
                                  class="group self-start flex items-center gap-2 bg-white/5 hover:bg-brand/10 border border-white/5 hover:border-brand/30 px-3 py-1.5 rounded-xl cursor-pointer transition-all active:scale-95"
                                  title="点击复制直链">
                                 <span class="text-[10px] text-gray-500 font-mono tracking-tighter uppercase">ID:</span>
                                 <span class="text-xs font-mono text-gray-400 group-hover:text-brand transition-colors">{{ item.sub_id }}</span>
                                 <svg class="w-3 h-3 text-gray-600 group-hover:text-brand transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                     <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                 </svg>
                             </div>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-2.5">
                        <span v-for="t in item.tags" :key="t" class="text-[12px] bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 font-bold hover:border-brand/30 transition-colors">{{ t }}</span>
                    </div>

                    <div class="flex-1">
                        <h4 class="text-[10px] text-brand font-bold mb-3 uppercase tracking-widest opacity-80">Description</h4>
                        <div class="markdown-body text-sm leading-relaxed" @click="handleMdClick">
                            <div v-html="renderedDescription"></div>
                        </div>
                    </div>

                    <div class="pt-6 pb-10 mt-auto flex flex-col gap-4">
                      <button v-if="item.filename && item.filename.endsWith('.litematic')"
                              @click="$parent.open3DPreview(item)"
                              class="group relative overflow-hidden bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/30 text-[#F59E0B] text-center py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.97]">
                        <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>

                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke-width="2" />
                          <path d="M12 22V12" stroke-width="2" /><path d="M12 12l8.73-5.04" stroke-width="2" /><path d="M12 12L3.27 6.96" stroke-width="2" />
                        </svg>
                        投影预览
                      </button>

                      <a :href="$parent.getDownloadLink(item)" class="..."></a>
                        <div class="flex items-center justify-between px-4 py-3 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                            <div class="flex items-center gap-3 text-left">
                                <div class="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14H11V21L20 10H13Z" /></svg>
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-xs font-bold text-gray-200">GitHub 下载加速</span>
                                    <span class="text-[10px] text-gray-500 font-medium">如果下载速度慢请开启</span>
                                </div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" :checked="$root.useProxy" @change="$root.useProxy = $event.target.checked" class="sr-only peer">
                                <div class="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand peer-checked:after:bg-black"></div>
                            </label>
                        </div>

                        <a :href="$parent.getDownloadLink(item)" class="bg-brand hover:brightness-110 text-black text-center py-4 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.97] shadow-xl shadow-brand/20">
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                  stroke-width="2.5"
                                  stroke-linecap="round"
                                  stroke-linejoin="round"/>
                          </svg>
                            下载文件
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>`
};