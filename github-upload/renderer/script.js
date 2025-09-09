// PromptCard Desktop - 主要JavaScript逻辑
let ipcRenderer, fs, path;

// 检查是否在Electron环境中
try {
    const electron = require('electron');
    ipcRenderer = electron.ipcRenderer;
    fs = require('fs');
    path = require('path');
    console.log('✓ Electron模块加载成功');
    
    // 添加IPC事件监听
    ipcRenderer.on('prepare-card-for-screenshot', (event, cardId) => {
        console.log('准备截图卡片:', cardId);
        const card = document.querySelector(`.card[data-card-id="${cardId}"]`);
        if (card) {
            // 滚动到卡片位置
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // 添加临时高亮效果
            card.classList.add('screenshot-highlight');
            
            // 500毫秒后移除高亮效果
            setTimeout(() => {
                card.classList.remove('screenshot-highlight');
            }, 500);
        }
    });
} catch (error) {
    console.error('❌ Electron模块加载失败:', error);
    // 模拟模块（用于测试）
    ipcRenderer = {
        invoke: async (channel) => {
            if (channel === 'get-data-directory') {
                return './data';
            }
            return null;
        }
    };
    fs = { existsSync: () => false, readFileSync: () => '{}', writeFileSync: () => {}, mkdirSync: () => {} };
    path = { join: (...args) => args.join('/') };
}

// 应用状态管理
class AppState {
    constructor() {
        this.cards = [];
        this.folders = [];
        this.customTags = {
            models: [],
            platforms: []
        };
        this.settings = {
            imagePath: '',
            dataDirectory: '',
            defaultCategory: 'uncategorized' // 默认使用未分类
        };
        this.currentCategory = 'all';
        this.searchQuery = '';
        this.selectedTags = {
            models: [],
            platforms: []
        };
        this.sortBy = 'date'; // 默认按日期排序
        this.sortOrder = 'desc'; // 默认倒序排列
        this.isLoading = false;
        
        // 立即初始化默认数据
        this.initializeDefaults();
    }

    // 初始化默认数据
    initializeDefaults() {
        // 默认文件夹
        this.folders = [
            { id: 'uncategorized', name: '未分类', icon: 'fas fa-inbox', parent: null, children: [], order: 0, isCustom: false },
            { id: 'ai-chat', name: 'AI对话', icon: 'fas fa-comments', parent: null, children: [], order: 1, isCustom: false },
            { id: 'ai-art', name: 'AI绘画', icon: 'fas fa-palette', parent: null, children: [], order: 2, isCustom: false },
            { id: 'ai-video', name: 'AI视频', icon: 'fas fa-video', parent: null, children: [], order: 3, isCustom: false },
            { id: 'ai-coding', name: 'AI编程', icon: 'fas fa-code', parent: null, children: [], order: 4, isCustom: false },
            { id: 'ai-agent', name: '智能体', icon: 'fas fa-robot', parent: null, children: [], order: 5, isCustom: false }
        ];

        // 预设模型标签
        this.presetModels = [
            'Gemini 2.5 Pro', 'GPT-5', '豆包', 'K2'
        ];

        // 预设平台标签
        this.presetPlatforms = [
            { name: 'Gemini', url: 'https://gemini.google.com/u/1/app/c37b41a750ea7aa3?utm_source=deepmind.google&utm_medium=referral&utm_campaign=gdm&utm_content=' },
            { name: 'Google AI Studio', url: 'https://aistudio.google.com/prompts/new_chat?model=gemini-2.5-pro' },
            { name: 'ChatGPT', url: 'https://chatgpt.com/' },
            { name: 'lmarena', url: 'https://lmarena.ai/' },
            { name: 'Civitai', url: 'https://civitai.com/' }
        ];
    }

    // 保存数据到本地
    async saveData() {
        try {
            const dataDir = await ipcRenderer.invoke('get-data-directory');
            const dataFile = path.join(dataDir, 'cards.json');
            
            const data = {
                cards: this.cards,
                folders: this.folders,
                customTags: this.customTags,
                settings: this.settings,
                version: '1.0.0',
                lastModified: new Date().toISOString()
            };

            fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('保存数据失败:', error);
            return false;
        }
    }

    // 从本地加载数据
    async loadData() {
        try {
            const dataDir = await ipcRenderer.invoke('get-data-directory');
            this.settings.dataDirectory = dataDir;
            
            const dataFile = path.join(dataDir, 'cards.json');
            
            if (fs.existsSync(dataFile)) {
                const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
                
                this.cards = data.cards || [];
                this.folders = data.folders || [];
                this.customTags = data.customTags || { models: [], platforms: [] };
                this.settings = { ...this.settings, ...data.settings };
                
                // 如果没有文件夹数据，初始化默认文件夹
                if (this.folders.length === 0) {
                    this.initializeDefaults();
                }
            } else {
                // 首次运行，初始化默认数据
                this.initializeDefaults();
                await this.saveData();
            }
            
            console.log('数据加载成功:', { 
                cards: this.cards.length, 
                folders: this.folders.length, 
                customTags: this.customTags 
            });
            return true;
        } catch (error) {
            console.error('加载数据失败:', error);
            // 出错时仍然初始化默认数据
            this.initializeDefaults();
            return false;
        }
    }

    // 添加卡片
    addCard(cardData) {
        const card = {
            id: Date.now().toString(),
            type: cardData.type || 'text',
            title: cardData.title || '',
            description: cardData.description || '',
            author: cardData.author || '', // 允许为空
            category: cardData.category || this.settings.defaultCategory || 'uncategorized', // 使用配置的默认分类
            tags: cardData.tags || [],
            models: cardData.models || [], // 允许为空
            websites: cardData.websites || [], // 允许为空
            images: cardData.images || [],
            favorite: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.cards.unshift(card);
        this.saveData();
        return card;
    }

    // 更新卡片
    updateCard(cardId, updates) {
        const cardIndex = this.cards.findIndex(card => card.id === cardId);
        if (cardIndex !== -1) {
            this.cards[cardIndex] = {
                ...this.cards[cardIndex],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.saveData();
            return this.cards[cardIndex];
        }
        return null;
    }

    // 删除卡片
    deleteCard(cardId) {
        const cardIndex = this.cards.findIndex(card => card.id === cardId);
        if (cardIndex !== -1) {
            this.cards.splice(cardIndex, 1);
            this.saveData();
            return true;
        }
        return false;
    }

    // 切换收藏状态
    toggleFavorite(cardId) {
        const card = this.cards.find(card => card.id === cardId);
        if (card) {
            card.favorite = !card.favorite;
            card.updatedAt = new Date().toISOString();
            this.saveData();
            return card.favorite;
        }
        return false;
    }

    // 添加自定义文件夹
    addFolder(folderData) {
        const folder = {
            id: Date.now().toString(),
            name: folderData.name,
            icon: folderData.icon || 'fas fa-folder',
            parent: folderData.parent || null,
            children: [],
            order: this.getNextFolderOrder(folderData.parent),
            isCustom: true
        };

        this.folders.push(folder);
        
        // 如果有父文件夹，添加到父文件夹的children数组
        if (folder.parent) {
            const parentFolder = this.folders.find(f => f.id === folder.parent);
            if (parentFolder) {
                parentFolder.children.push(folder.id);
            }
        }

        this.saveData();
        return folder;
    }

    // 获取下一个文件夹排序号
    getNextFolderOrder(parentId) {
        const siblings = this.folders.filter(f => f.parent === parentId);
        return siblings.length > 0 ? Math.max(...siblings.map(f => f.order)) + 1 : 1;
    }

    // 重命名文件夹
    renameFolder(folderId, newName) {
        const folder = this.folders.find(f => f.id === folderId);
        if (folder && folder.isCustom) {
            folder.name = newName;
            this.saveData();
            return true;
        }
        return false;
    }

    // 删除文件夹
    deleteFolder(folderId) {
        const folder = this.folders.find(f => f.id === folderId);
        if (!folder || !folder.isCustom) return false;

        // 移动该文件夹下的卡片到默认分类
        this.cards.forEach(card => {
            if (card.category === folderId) {
                card.category = 'ai-chat';
            }
        });

        // 删除子文件夹
        folder.children.forEach(childId => {
            this.deleteFolder(childId);
        });

        // 从父文件夹的children中移除
        if (folder.parent) {
            const parentFolder = this.folders.find(f => f.id === folder.parent);
            if (parentFolder) {
                parentFolder.children = parentFolder.children.filter(id => id !== folderId);
            }
        }

        // 删除文件夹
        this.folders = this.folders.filter(f => f.id !== folderId);
        this.saveData();
        return true;
    }

    // 获取过滤后的卡片
    getFilteredCards() {
        try {
            let filteredCards = [...this.cards];

            // 按分类过滤
            if (this.currentCategory !== 'all') {
                if (this.currentCategory === 'recent') {
                    // 最近使用：按更新时间排序，取前20个
                    filteredCards.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                    filteredCards = filteredCards.slice(0, 20);
                } else if (this.currentCategory === 'favorites') {
                    filteredCards = filteredCards.filter(card => card.favorite);
                } else {
                    filteredCards = filteredCards.filter(card => card.category === this.currentCategory);
                }
            }

            // 按搜索关键词过滤
            if (this.searchQuery) {
                const query = this.searchQuery.toLowerCase();
                filteredCards = filteredCards.filter(card => {
                    const models = card.models || [];
                    const websites = card.websites || [];
                    return card.title.toLowerCase().includes(query) ||
                        card.description.toLowerCase().includes(query) ||
                        card.author.toLowerCase().includes(query) ||
                        models.some(model => model.toLowerCase().includes(query)) ||
                        websites.some(website => website.name.toLowerCase().includes(query));
                });
            }

            // 按标签过滤（使用AND逻辑，必须包含所有选中标签）
            if (this.selectedTags.models && this.selectedTags.models.length > 0) {
                filteredCards = filteredCards.filter(card => {
                    const cardModels = card.models || [];
                    return this.selectedTags.models.every(tag => cardModels.includes(tag));
                });
            }

            if (this.selectedTags.platforms && this.selectedTags.platforms.length > 0) {
                filteredCards = filteredCards.filter(card => {
                    const cardWebsites = card.websites || [];
                    return this.selectedTags.platforms.every(tag => 
                        cardWebsites.some(website => website.name === tag)
                    );
                });
            }

            // 按照排序设置对卡片进行排序
            if (this.currentCategory !== 'recent') { // 如果不是最近使用分类（已有排序逻辑）
                if (this.sortBy === 'date') {
                    // 按创建日期排序
                    filteredCards.sort((a, b) => {
                        const dateA = new Date(a.createdAt);
                        const dateB = new Date(b.createdAt);
                        return this.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
                    });
                } else if (this.sortBy === 'title') {
                    // 按标题排序
                    filteredCards.sort((a, b) => {
                        const titleA = (a.title || '').toLowerCase();
                        const titleB = (b.title || '').toLowerCase();
                        return this.sortOrder === 'asc' 
                            ? titleA.localeCompare(titleB) 
                            : titleB.localeCompare(titleA);
                    });
                }
            }

            return filteredCards;
        } catch (error) {
            console.error('过滤卡片时出错:', error);
            return [];
        }
    }

    // 获取所有模型标签（预设+自定义+卡片中使用的）
    getAllModelTags() {
        try {
            // 确保presetModels已初始化
            if (!this.presetModels || !Array.isArray(this.presetModels)) {
                console.warn('presetModels未初始化，使用默认值');
                this.initializeDefaults();
            }
            
            const cardModels = [...new Set(this.cards.flatMap(card => card.models || []))];
            const allModels = [...new Set([...this.presetModels, ...this.customTags.models, ...cardModels])];
            
            return allModels.map(model => ({
                name: model,
                count: this.cards.filter(card => (card.models || []).includes(model)).length,
                isPreset: this.presetModels.includes(model),
                isCustom: this.customTags.models.includes(model)
            }));
        } catch (error) {
            console.error('获取模型标签时出错:', error);
            return [];
        }
    }

    // 获取所有平台标签
    getAllPlatformTags() {
        try {
            // 确保presetPlatforms已初始化
            if (!this.presetPlatforms || !Array.isArray(this.presetPlatforms)) {
                console.warn('presetPlatforms未初始化，使用默认值');
                this.initializeDefaults();
            }
            
            const cardPlatforms = [...new Set(this.cards.flatMap(card => (card.websites || []).map(w => w.name)))];
            const presetPlatformNames = this.presetPlatforms.map(p => p.name);
            const allPlatforms = [...new Set([...presetPlatformNames, ...this.customTags.platforms, ...cardPlatforms])];
            
            return allPlatforms.map(platform => ({
                name: platform,
                count: this.cards.filter(card => (card.websites || []).some(w => w.name === platform)).length,
                isPreset: presetPlatformNames.includes(platform),
                isCustom: this.customTags.platforms.includes(platform)
            }));
        } catch (error) {
            console.error('获取平台标签时出错:', error);
            return [];
        }
    }

    // 添加自定义标签
    addCustomTag(type, name, url = null) {
        if (type === 'models' && !this.customTags.models.includes(name)) {
            this.customTags.models.push(name);
        } else if (type === 'platforms' && !this.customTags.platforms.includes(name)) {
            this.customTags.platforms.push(name);
            if (url) {
                // 如果提供了URL，添加到预设平台列表
                this.presetPlatforms.push({ name, url });
            }
        }
        this.saveData();
    }

    // 删除自定义标签
    removeCustomTag(type, name) {
        if (type === 'models') {
            this.customTags.models = this.customTags.models.filter(tag => tag !== name);
        } else if (type === 'platforms') {
            this.customTags.platforms = this.customTags.platforms.filter(tag => tag !== name);
            // 同时从预设平台列表中移除
            this.presetPlatforms = this.presetPlatforms.filter(p => p.name !== name);
        }
        this.saveData();
    }
}

// 全局应用状态实例
const appState = new AppState();

// UI管理类
class UIManager {
    constructor() {
        this.modalContainer = document.getElementById('modalContainer');
        this.notificationContainer = document.getElementById('notificationContainer');
        this.currentModal = null;
    }

    // 显示通知
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        this.notificationContainer.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    // 显示模态框
    showModal(templateId, data = {}) {
        const template = document.getElementById(templateId);
        if (!template) return null;

        const modalHtml = template.innerHTML;
        this.modalContainer.innerHTML = modalHtml;
        
        const modal = this.modalContainer.querySelector('.modal-overlay');
        if (!modal) return null;

        this.currentModal = modal;
        
        // 添加关闭事件
        const closeButtons = modal.querySelectorAll('.modal-close, .modal-cancel');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        // 点击遮罩关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // ESC键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        return modal;
    }

    // 关闭模态框
    closeModal() {
        if (this.currentModal) {
            this.currentModal.style.animation = 'fadeOut 0.2s forwards';
            setTimeout(() => {
                this.modalContainer.innerHTML = '';
                this.currentModal = null;
            }, 200);
        }
    }

    // 复制到剪贴板
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('已复制到剪贴板', 'success');
            return true;
        } catch (error) {
            console.error('复制失败:', error);
            this.showNotification('复制失败', 'error');
            return false;
        }
    }

    // 确认对话框
    async confirm(message, title = '确认') {
        return new Promise((resolve) => {
            const modal = this.showModal('confirmModalTemplate');
            if (!modal) {
                resolve(false);
                return;
            }

            const titleEl = modal.querySelector('.modal-header h3');
            const messageEl = modal.querySelector('.confirm-message');
            const confirmBtn = modal.querySelector('.modal-confirm');
            const cancelBtn = modal.querySelector('.modal-cancel');

            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.textContent = message;

            const handleConfirm = () => {
                this.closeModal();
                resolve(true);
            };

            const handleCancel = () => {
                this.closeModal();
                resolve(false);
            };

            if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
            if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
        });
    }

    // 渲染侧边栏
    renderSidebar() {
        const categoriesMenu = document.getElementById('categoriesMenu');
        if (!categoriesMenu) return;

        // 保留预设分类，只清空自定义文件夹
        const customFolders = categoriesMenu.querySelectorAll('.custom-folder');
        customFolders.forEach(folder => folder.remove());

        // 渲染自定义文件夹
        const customFoldersData = appState.folders.filter(f => f.isCustom && !f.parent);
        customFoldersData.sort((a, b) => a.order - b.order);

        customFoldersData.forEach(folder => {
            this.renderFolderItem(folder, categoriesMenu);
        });

        // 更新计数
        this.updateCategoryCounts();
    }

    // 渲染文件夹项
    renderFolderItem(folder, container, level = 0) {
        const li = document.createElement('li');
        li.className = 'menu-item category-item custom-folder';
        li.dataset.category = folder.id;
        li.style.paddingLeft = `${16 + level * 20}px`;
        
        li.innerHTML = `
            <i class="${folder.icon}"></i>
            <span class="folder-name">${folder.name}</span>
            <span class="count-badge">0</span>
            <div class="folder-actions" style="display: none;">
                <button class="folder-action-btn add-subfolder" title="添加子文件夹">
                    <i class="fas fa-plus"></i>
                </button>
                <button class="folder-action-btn rename-folder" title="重命名">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="folder-action-btn delete-folder" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        // 添加悬停事件
        li.addEventListener('mouseenter', () => {
            const actions = li.querySelector('.folder-actions');
            if (actions) actions.style.display = 'flex';
        });

        li.addEventListener('mouseleave', () => {
            const actions = li.querySelector('.folder-actions');
            if (actions) actions.style.display = 'none';
        });

        // 添加点击事件
        li.addEventListener('click', (e) => {
            if (!e.target.closest('.folder-actions')) {
                this.selectCategory(folder.id);
            }
        });

        // 添加操作按钮事件
        const addSubfolderBtn = li.querySelector('.add-subfolder');
        const renameFolderBtn = li.querySelector('.rename-folder');
        const deleteFolderBtn = li.querySelector('.delete-folder');

        if (addSubfolderBtn) {
            addSubfolderBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showCreateFolderModal(folder.id);
            });
        }

        if (renameFolderBtn) {
            renameFolderBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showRenameFolderModal(folder.id);
            });
        }

        if (deleteFolderBtn) {
            deleteFolderBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const confirmed = await this.confirm(`确定要删除文件夹"${folder.name}"吗？此操作不可撤销。`);
                if (confirmed) {
                    appState.deleteFolder(folder.id);
                    this.renderSidebar();
                    this.renderCards();
                    this.showNotification('文件夹已删除', 'success');
                }
            });
        }

        container.appendChild(li);

        // 递归渲染子文件夹
        if (folder.children.length > 0) {
            folder.children.forEach(childId => {
                const childFolder = appState.folders.find(f => f.id === childId);
                if (childFolder) {
                    this.renderFolderItem(childFolder, container, level + 1);
                }
            });
        }
    }

    // 更新分类计数
    updateCategoryCounts() {
        // 更新全部卡片计数
        const allCount = document.getElementById('allCount');
        if (allCount) allCount.textContent = appState.cards.length;

        // 更新最近使用计数
        const recentCount = document.getElementById('recentCount');
        if (recentCount) {
            const recentCards = appState.cards
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                .slice(0, 20);
            recentCount.textContent = recentCards.length;
        }

        // 更新收藏计数
        const favoritesCount = document.getElementById('favoritesCount');
        if (favoritesCount) {
            favoritesCount.textContent = appState.cards.filter(card => card.favorite).length;
        }

        // 更新分类计数
        const categoryItems = document.querySelectorAll('.category-item');
        categoryItems.forEach(item => {
            const categoryId = item.dataset.category;
            const countBadge = item.querySelector('.count-badge');
            if (countBadge) {
                const count = appState.cards.filter(card => card.category === categoryId).length;
                countBadge.textContent = count;
            }
        });
    }

    // 选择分类
    selectCategory(categoryId) {
        // 更新状态
        appState.currentCategory = categoryId;

        // 更新UI
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.category === categoryId) {
                item.classList.add('active');
            }
        });

        // 更新标题
        const contentTitle = document.getElementById('contentTitle');
        if (contentTitle) {
            let title = '全部卡片';
            if (categoryId === 'recent') title = '最近使用';
            else if (categoryId === 'favorites') title = '我的收藏';
            else {
                const folder = appState.folders.find(f => f.id === categoryId);
                if (folder) title = folder.name;
            }
            contentTitle.textContent = title;
        }

        // 重新渲染卡片
        cardRenderer.renderCards();
    }

    // 渲染标签云
    renderTagClouds() {
        this.renderModelTags();
        this.renderPlatformTags();
    }

    // 渲染模型标签
    renderModelTags() {
        console.log('渲染模型标签...');
        
        const container = document.getElementById('modelTags');
        if (!container) {
            console.error('未找到模型标签容器');
            return;
        }

        try {
            const modelTags = appState.getAllModelTags();
            console.log('模型标签数据:', modelTags);
            
            container.innerHTML = '';

            // 添加“全部”选项
            const allTagEl = document.createElement('div');
            allTagEl.className = 'tag-item';
            allTagEl.dataset.tag = 'all';
            if (appState.selectedTags.models.length === 0) {
                allTagEl.classList.add('active');
            }
            allTagEl.innerHTML = `
                <span>全部</span>
                <span class="tag-count">${appState.cards.length}</span>
            `;
            allTagEl.addEventListener('click', () => {
                appState.selectedTags.models = [];
                this.renderModelTags();
                this.renderCards();
            });
            container.appendChild(allTagEl);

            modelTags.forEach(tag => {
                if (tag.count > 0 || tag.isPreset) {
                    const tagEl = document.createElement('div');
                    tagEl.className = 'tag-item';
                    tagEl.dataset.tag = tag.name;
                    
                    if (appState.selectedTags.models.includes(tag.name)) {
                        tagEl.classList.add('active');
                    }
                    
                    tagEl.innerHTML = `
                        <span>${tag.name}</span>
                        <span class="tag-count">${tag.count}</span>
                    `;
                    
                    tagEl.addEventListener('click', () => {
                        this.toggleModelTag(tag.name);
                    });
                    
                    container.appendChild(tagEl);
                }
            });
            
            console.log('模型标签渲染完成');
        } catch (error) {
            console.error('渲染模型标签时出错:', error);
        }
    }

    // 渲染平台标签
    renderPlatformTags() {
        console.log('渲染平台标签...');
        
        const container = document.getElementById('platformTags');
        if (!container) {
            console.error('未找到平台标签容器');
            return;
        }

        try {
            const platformTags = appState.getAllPlatformTags();
            console.log('平台标签数据:', platformTags);
            
            container.innerHTML = '';

            // 添加“全部”选项
            const allTagEl = document.createElement('div');
            allTagEl.className = 'tag-item';
            allTagEl.dataset.tag = 'all';
            if (appState.selectedTags.platforms.length === 0) {
                allTagEl.classList.add('active');
            }
            allTagEl.innerHTML = `
                <span>全部</span>
                <span class="tag-count">${appState.cards.length}</span>
            `;
            allTagEl.addEventListener('click', () => {
                appState.selectedTags.platforms = [];
                this.renderPlatformTags();
                this.renderCards();
            });
            container.appendChild(allTagEl);

            platformTags.forEach(tag => {
                if (tag.count > 0 || tag.isPreset) {
                    const tagEl = document.createElement('div');
                    tagEl.className = 'tag-item';
                    tagEl.dataset.tag = tag.name;
                    
                    if (appState.selectedTags.platforms.includes(tag.name)) {
                        tagEl.classList.add('active');
                    }
                    
                    tagEl.innerHTML = `
                        <span>${tag.name}</span>
                        <span class="tag-count">${tag.count}</span>
                    `;
                    
                    tagEl.addEventListener('click', () => {
                        this.togglePlatformTag(tag.name);
                    });
                    
                    container.appendChild(tagEl);
                }
            });
            
            console.log('平台标签渲染完成');
        } catch (error) {
            console.error('渲染平台标签时出错:', error);
        }
    }

    // 切换模型标签选择
    toggleModelTag(tagName) {
        const index = appState.selectedTags.models.indexOf(tagName);
        if (index > -1) {
            appState.selectedTags.models.splice(index, 1);
        } else {
            appState.selectedTags.models.push(tagName);
        }
        
        this.renderModelTags();
        this.renderCards();
    }

    // 切换平台标签选择
    togglePlatformTag(tagName) {
        const index = appState.selectedTags.platforms.indexOf(tagName);
        if (index > -1) {
            appState.selectedTags.platforms.splice(index, 1);
        } else {
            appState.selectedTags.platforms.push(tagName);
        }
        
        this.renderPlatformTags();
        this.renderCards();
    }

    // 显示创建文件夹模态框
    showCreateFolderModal(parentId = null) {
        showCreateFolderModal(parentId);
    }

    // 显示重命名文件夹模态框
    showRenameFolderModal(folderId) {
        showRenameFolderModal(folderId);
    }

    // 渲染卡片（委托给CardRenderer）
    renderCards() {
        
    }
}

// 全局UI管理器实例
const uiManager = new UIManager();

// 卡片渲染类
class CardRenderer {
    // 渲染卡片列表
    renderCards() {
        console.log('开始渲染卡片...');
        
        const container = document.getElementById('cardsContainer');
        const emptyState = document.getElementById('emptyState');
        
        if (!container) {
            console.error('未找到卡片容器');
            return;
        }

        const filteredCards = appState.getFilteredCards();
        console.log(`过滤后的卡片数量: ${filteredCards.length}`);
        
        if (filteredCards.length === 0) {
            container.innerHTML = '';
            if (emptyState) {
                container.appendChild(emptyState);
            }
            return;
        }

        // 隐藏空状态
        if (emptyState && emptyState.parentNode) {
            emptyState.parentNode.removeChild(emptyState);
        }

        // 设置网格视图样式
        container.className = 'cards-container cards-grid';
        
        container.innerHTML = '';
        
        try {
            filteredCards.forEach((card, index) => {
                console.log(`渲染卡片 ${index + 1}: ${card.title}`);
                const cardEl = this.createCardElement(card);
                container.appendChild(cardEl);
            });
            
            console.log('卡片渲染完成');
        } catch (error) {
            console.error('渲染卡片时出错:', error);
        }
    }

    // 创建卡片元素
    createCardElement(card) {
        try {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            cardEl.dataset.cardId = card.id;
            
            const imageSection = (card.type === 'image') ? 
                (card.images && card.images.length > 0) ?
                    this.renderCardImages(card) : 
                    this.renderImagePlaceholder(card)
                : '';
            
            const tagsSection = this.renderCardTags(card);
            const websitesSection = this.renderCardWebsites(card);
            const categoryName = this.getCategoryName(card.category);
            
            cardEl.innerHTML = `
                ${imageSection}
                <div class="card-content">
                    <div class="card-title">${this.escapeHtml(card.title || '')}</div>
                    <div class="card-description">${this.escapeHtml(card.description || '')}</div>
                    <div class="card-meta">
                        <div class="card-author">${this.escapeHtml(card.author || '')}</div>
                        <div class="category-select-container">
                            <select class="card-category-select" data-card-id="${card.id}" disabled>
                                ${appState.folders.map(cat => 
                                    `<option value="${cat.id}" ${cat.id === (card.category || '') ? 'selected' : ''}>
                                        ${this.escapeHtml(cat.name)}
                                    </option>`
                            ).join('')}
                            </select>
                            <i class="fas fa-lock lock-icon" title="点击编辑按钮解锁"></i>
                        </div>
                    </div>
                    ${tagsSection}
                    ${websitesSection}
                    <div class="card-footer">
                        <div class="card-date">
                            <i class="fas fa-calendar-alt"></i>
                            ${this.formatDateTime(card.createdAt)}
                        </div>
                        <div class="card-actions">
                            <button class="card-action-btn screenshot-card" title="截图卡片">
                                <i class="fas fa-camera"></i>
                            </button>
                            <button class="copy-btn" data-copy="title" title="复制标题">
                                <i class="fas fa-heading"></i> 标题
                            </button>
                            <button class="copy-btn" data-copy="content" title="复制内容">
                                <i class="fas fa-align-left"></i> 内容
                            </button>
                            <button class="copy-btn" data-copy="models" title="复制模型名字">
                                <i class="fas fa-robot"></i> 模型
                            </button>
                            <button class="card-action-btn favorite ${card.favorite ? 'active' : ''}" title="收藏">
                                <i class="fas fa-heart"></i>
                            </button>
                            <button class="card-action-btn edit" title="编辑">
                                <i class="fas fa-edit"></i>
                                <span>编辑</span>
                            </button>
                            <button class="card-action-btn delete" title="删除">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // 添加事件监听
            this.addCardEventListeners(cardEl, card);
            
            return cardEl;
        } catch (error) {
            console.error('创建卡片元素时出错:', error, card);
            
            // 返回一个简单的错误卡片
            const errorCard = document.createElement('div');
            errorCard.className = 'card error';
            errorCard.innerHTML = `
                <div class="card-content">
                    <div class="card-title">卡片加载错误</div>
                    <div class="card-description">无法显示此卡片的内容</div>
                </div>
            `;
            return errorCard;
        }
    }

    // 渲染卡片图片
    renderCardImages(card) {
        if (!card.images || card.images.length === 0) return '';

        const getImagePath = (image) => {
            if (image.path && image.path.startsWith('data:')) {
                return image.path;
            } else if (image.path) {
                return `file://${image.path}`;
            } else {
                return ''; // 或者返回一个默认占位符图片路径
            }
        };

        let imagesHtml = card.images.map(image => {
            const imageSrc = getImagePath(image);
            return `
                <div class="card-image-wrapper">
                    <img class="card-image" src="${imageSrc}" alt="${this.escapeHtml(card.title)}"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                         onclick="cardManager.viewImage('${card.id}', '${this.escapeHtml(image.path)}')">
                    <div class="image-error" style="display:none; align-items:center; justify-content:center; height:100%; background:#f8f9fa; color:#6c757d; position:absolute; top:0; left:0; right:0; bottom:0;">
                        <div style="text-align:center;">
                            <i class="fas fa-exclamation-triangle" style="font-size:32px; margin-bottom:8px; display:block;"></i>
                            <span>图片加载失败</span>
                        </div>
                    </div>

                    <button class="delete-image-btn" data-card-id="${card.id}" data-image-path="${this.escapeHtml(image.path)}" title="删除图片">
                        <i class="fas fa-times-circle"></i>
                    </button>

                </div>
            `;
        }).join('');

        return `
            <div class="card-image-section">
                ${imagesHtml}
            </div>
        `;
    }

    // 渲染图片占位符（用于没有图片的图片卡片）
    renderImagePlaceholder(card) {
        return `
            <div class="card-image-section">
                <div class="image-upload-container" data-card-id="${card.id}">
                    <input type="file" class="image-file-input" multiple accept="image/*" style="display: none;" id="imageInput-${card.id}">
                    <div class="image-upload-area" onclick="document.getElementById('imageInput-${card.id}').click()">
                        <div class="image-placeholder-content">
                            <i class="fas fa-cloud-upload-alt" style="font-size: 48px; margin-bottom: 12px; color: #007bff;"></i>
                            <p style="margin: 8px 0; font-weight: 500;">点击上传图片或拖拽到此处</p>
                            <p style="margin: 4px 0; font-size: 12px; color: #6c757d;">支持 JPG, PNG, GIF, WebP 格式，最大10MB</p>
                        </div>
                    </div>
                    <div class="uploaded-images-container" style="display: none;"></div>
                </div>
            </div>
        `;
    }

    // 渲染卡片标签
    renderCardTags(card) {
        const tagsHtml = (card.models && card.models.length > 0) ? 
            card.models.map(model => 
                `<span class="card-tag">${this.escapeHtml(model)}</span>`
            ).join('') : '<span class="card-tag-placeholder">暂无模型标签</span>';
        
        return `<div class="card-tags">${tagsHtml}</div>`;
    }

    // 渲染卡片网站
    renderCardWebsites(card) {
        const websitesHtml = (card.websites && card.websites.length > 0) ?
            card.websites.map(website => 
                `<a href="#" class="card-website" data-url="${this.escapeHtml(website.url)}">
                    <i class="fas fa-external-link-alt"></i>
                    ${this.escapeHtml(website.name)}
                </a>`
            ).join('') : '<span class="card-website-placeholder">暂无平台标签</span>';
        
        return `<div class="card-websites">${websitesHtml}</div>`;
    }

    // 添加卡片事件监听
    addCardEventListeners(cardEl, card) {
        // 截图按钮
        const screenshotBtn = cardEl.querySelector('.screenshot-card');
        if (screenshotBtn) {
            screenshotBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.captureCardScreenshot(card.id, cardEl);
            });
        }
        
        // 复制按钮
        const copyButtons = cardEl.querySelectorAll('.copy-btn');
        copyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const type = btn.dataset.copy;
                let text = '';
                
                if (type === 'title') {
                    text = card.title;
                } else if (type === 'content') {
                    text = card.description;
                } else if (type === 'models') {
                    text = card.models ? card.models.join(', ') : '';
                }
                
                uiManager.copyToClipboard(text);
            });
        });
        
        // 捕获卡片截图
        this.captureCardScreenshot = async (cardId, cardEl) => {
        try {
            // 检查是否设置了截图保存目录
            if (!appState.settings.screenshotPath) {
                uiManager.showNotification('请先在设置中配置截图保存目录', 'warning');
                uiManager.openModal('settings');
                return;
            }

            // 调用主进程进行截图
            const result = await ipcRenderer.invoke('capture-card-screenshot', { cardId });
            
            if (result.success) {
                // 生成文件名
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const fileName = `card-${cardId}-${timestamp}.png`;
                const filePath = path.join(appState.settings.screenshotPath, fileName);
                
                // 保存截图
                const saveResult = await ipcRenderer.invoke('save-screenshot', {
                    base64Data: result.data,
                    filePath: filePath
                });
                
                if (saveResult.success) {
                    uiManager.showNotification('截图已保存', 'success');
                } else {
                    uiManager.showNotification(`保存截图失败: ${saveResult.error}`, 'error');
                }
            } else {
                uiManager.showNotification(`截图失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('截图出错:', error);
            uiManager.showNotification(`截图出错: ${error.message}`, 'error');
        }
        };

        // 收藏按钮
        const favoriteBtn = cardEl.querySelector('.favorite');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isFavorite = appState.toggleFavorite(card.id);
                favoriteBtn.classList.toggle('active', isFavorite);
                
            });
        }

        // 保存按钮
        const saveBtn = cardEl.querySelector('.save-card');
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // 手动保存卡片数据
                const saved = appState.saveData();
                if (saved) {
                    uiManager.showNotification('卡片已保存', 'success');
                    cardManager.cancelEdit(card); // 保存成功后退出编辑模式
                } else {
                    uiManager.showNotification('保存失败', 'error');
                }
            });
        }

        // 编辑按钮
        const editBtn = cardEl.querySelector('.edit');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                cardManager.enterEditMode(cardEl, card);
            });
        }

        // 删除图片按钮
        const deleteImageBtns = cardEl.querySelectorAll('.delete-image-btn');
        deleteImageBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const imagePath = btn.dataset.imagePath;
                const cardId = btn.dataset.cardId;
                if (confirm('确定要删除这张图片吗？')) {
                    cardManager.deleteImage(cardId, imagePath);
                }
            });
        });

        // 删除按钮
        const deleteBtn = cardEl.querySelector('.delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const confirmed = await uiManager.confirm(`确定要删除卡片"${card.title}"吗？`);
                if (confirmed) {
                    appState.deleteCard(card.id);
                    this.renderCards();
                    uiManager.updateCategoryCounts();
                    
                    uiManager.showNotification('卡片已删除', 'success');
                }
            });
        }

        // 网站链接
        const websiteLinks = cardEl.querySelectorAll('.card-website');
        websiteLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = link.dataset.url;
                if (url) {
                    ipcRenderer.invoke('open-external', url);
                }
            });
        });
        
        // 如果是图片卡片，初始化图片上传功能
        if (card.type === 'image') {
            console.log('初始化图片卡片上传功能:', card.id);
            // 立即初始化，不需要延迟
            this.initializeImageUpload(cardEl, card);
        }
    }
    
    // 初始化图片上传功能（重构版本）
    initializeImageUpload(cardEl, card) {
        console.log('初始化简化版图片上传功能', card.id);
        
        const uploadContainer = cardEl.querySelector('.image-upload-container');
        const fileInput = cardEl.querySelector('.image-file-input');
        const uploadArea = cardEl.querySelector('.image-upload-area');
        const imagesContainer = cardEl.querySelector('.uploaded-images-container');
        
        if (!uploadContainer || !fileInput || !uploadArea) {
            console.error('图片上传区域元素不完整');
            return;
        }
        
        // 文件选择事件
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
                this.processImageFiles(files, card, imagesContainer);
            }
        });
        
        // 拖拽上传事件
        uploadArea.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('dragover');
        });
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!uploadArea.contains(e.relatedTarget)) {
                uploadArea.classList.remove('dragover');
            }
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                this.processImageFiles(files, card, imagesContainer);
            }
        });
        
        // 渲染已有图片
        if (card.images && card.images.length > 0) {
            this.toggleUploadAreaVisibility(uploadArea, imagesContainer, true);
            card.images.forEach(imageData => {
                this.renderImageItem(imageData, card, imagesContainer);
            });
        }
    }

    // 获取分类名称
    getCategoryName(categoryId) {
        if (!categoryId) return '未分类';
        const folder = appState.folders.find(f => f.id === categoryId);
        return folder ? folder.name : '未分类';
    }

    // 格式化日期
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
        
        return date.toLocaleDateString('zh-CN');
    }

    // 格式化日期时间（YYYY/MM/DD HH:MM）
    formatDateTime(dateString) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}/${month}/${day} ${hours}:${minutes}`;
    }

    // 转义HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // 为图片占位符初始化拖拽功能
    initializePlaceholderDragDrop(cardEl, card, placeholder) {
        console.log('初始化占位符拖拽功能', card.id);
        
        // 点击事件 - 进入编辑模式
        placeholder.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('点击占位符，进入编辑模式');
            cardManager.enterEditMode(cardEl, card);
        });
        
        // 拖拽事件
        placeholder.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
            placeholder.classList.add('dragover');
            console.log('拖拽进入占位符');
        });
        
        placeholder.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            placeholder.classList.add('dragover');
        });
        
        placeholder.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!placeholder.contains(e.relatedTarget)) {
                placeholder.classList.remove('dragover');
                console.log('拖拽离开占位符');
            }
        });
        
        placeholder.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            placeholder.classList.remove('dragover');
            console.log('文件放置在占位符，进入编辑模式并处理文件');
            
            // 先进入编辑模式
            cardManager.enterEditMode(cardEl, card);
            
            // 稍后处理图片文件
            setTimeout(() => {
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    cardManager.handleImageFiles(e.dataTransfer.files, cardEl);
                } else {
                    console.error('未检测到拖拽的文件');
                    uiManager.showNotification('未检测到图片文件', 'error');
                }
            }, 200);
        });
    }
    
    // 处理图片文件（简化版本）
    processImageFiles(files, card, container) {
        console.log('开始处理图片文件:', files.length, '个文件');
        
        const validFiles = Array.from(files).filter(file => {
            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/jpg'];
            if (!validTypes.includes(file.type)) {
                uiManager.showNotification(`不支持的文件格式: ${file.name}`, 'error');
                return false;
            }
            
            // 检查文件大小（10MB限制）
            if (file.size > 10 * 1024 * 1024) {
                uiManager.showNotification(`文件过大: ${file.name} (超过10MB)`, 'error');
                return false;
            }
            
            return true;
        });
        
        if (validFiles.length === 0) {
            uiManager.showNotification('没有有效的图片文件', 'error');
            return;
        }
        
        // 确保卡片有图片数组
        if (!card.images) card.images = [];
        
        // 处理每个文件
        validFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = {
                    name: file.name,
                    originalName: file.name,
                    path: e.target.result, // 使用 data URL
                    size: file.size,
                    isCover: card.images.length === 0 && index === 0, // 第一张图片设为封面
                    uploadedAt: new Date().toISOString()
                };
                
                card.images.push(imageData);
                
                // 显示图片容器并隐藏上传区域
                const uploadArea = container.parentNode.querySelector('.image-upload-area');
                this.toggleUploadAreaVisibility(uploadArea, container, true);
                
                // 渲染图片
                this.renderImageItem(imageData, card, container);
                
                // 如果是最后一张图片，保存数据并显示成功消息
                if (index === validFiles.length - 1) {
                    uiManager.showNotification(`成功上传 ${validFiles.length} 张图片`, 'success');
                    appState.saveData();
                }
            };
            
            reader.onerror = () => {
                console.error(`读取文件失败: ${file.name}`);
                uiManager.showNotification(`读取文件失败: ${file.name}`, 'error');
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    // 渲染单个图片项目
    renderImageItem(imageData, card, container) {
        const imageEl = document.createElement('div');
        imageEl.className = 'uploaded-image-item';
        
        // 创建图片源路径
        let imageSrc;
        if (imageData.path && imageData.path.startsWith('data:')) {
            imageSrc = imageData.path;
        } else if (imageData.path) {
            imageSrc = `file://${imageData.path}`;
        } else {
            console.error('图片路径错误:', imageData);
            return;
        }
        
        imageEl.innerHTML = `
            <div class="image-preview">
                <img src="${imageSrc}" alt="${this.escapeHtml(imageData.name || '')}" 
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                     onclick="cardManager.viewImage('${card.id}', '${this.escapeHtml(imageData.path)}')">
                <div class="image-error" style="display:none; align-items:center; justify-content:center; 
                     height:100%; background:#f8极f9fa; color:#6c757d; position:absolute; top:0; left:0; right:0; bottom:0;">
                    <div style="text-align:center;">
                        <i class="fas fa-exclamation-triangle" style="font-size:24px; margin-bottom:8px; display:block;"></i>
                        <span>图片加载失败</span>
                    </div>
                </div>
            </div>
            <div class="image-controls">
                <button class="image-control-btn set-cover" title="设为封面" ${imageData.isCover ? 'disabled' : ''}>
                    <i class="fas fa-star ${imageData.isCover ? 'active' : ''}"></i>
                </button>
                <button class="image-control-btn remove-image" title="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="image-info">
                <div class="image-name">${this.escapeHtml(imageData.name || '')}</div>
                <div class="image-size">${this.formatFileSize(imageData.size || 0)}</div>
            </div>
            
        `;
        
        // 添加事件监听
        const setCoverBtn = imageEl.querySelector('.set-cover');
        const removeBtn = imageEl.querySelector('.remove-image');
        
        setCoverBtn.addEventListener('click', () => {
            // 移除其他封面标记
            card.images.forEach(img => img.isCover = false);
            imageData.isCover = true;
            
            // 更新所有图片项目的UI
            container.querySelectorAll('.uploaded-image-item').forEach(item => {
                const coverBadge = item.querySelector('.cover-badge');
                const starIcon = item.querySelector('.set-cover i');
                const setCoverButton = item.querySelector('.set-cover');
                
                if (coverBadge) coverBadge.remove();
                starIcon.classList.remove('active');
                setCoverButton.disabled = false;
            });
            
            // 为当前图片添加封面标记
            const coverBadge = document.createElement('div');
            coverBadge.className = 'cover-badge';
            coverBadge.textContent = '封面';
            imageEl.appendChild(coverBadge);
            
            setCoverBtn.querySelector('i').classList.add('active');
            setCoverBtn.disabled = true;
            
            uiManager.showNotification('封面设置成功', 'success');
            appState.saveData();
        });
        
        removeBtn.addEventListener('click', async () => {
            const confirmed = await uiManager.confirm('确定要删除这张图片吗？');
            if (!confirmed) return;
            
            const index = card.images.indexOf(imageData);
            if (index !== -1) {
                card.images.splice(index, 1);
                appState.saveData();
            }
            
            imageEl.remove();
            
            // 如果没有图片了，显示上传区域
            if (card.images.length === 0) {
                const uploadArea = container.parentNode.querySelector('.image-upload-area');
                this.toggleUploadAreaVisibility(uploadArea, container, false);
            }
            
            uiManager.showNotification('图片已删除', 'success');
        });
        
        container.appendChild(imageEl);
    }
    
    // 切换上传区域和图片容器的可见性
    toggleUploadAreaVisibility(uploadArea, imagesContainer, showImages) {
        if (showImages) {
            // 显示图片容器，隐藏上传区域
            if (imagesContainer) imagesContainer.style.display = 'block';
            if (uploadArea) uploadArea.style.display = 'none';
        } else {
            // 显示上传区域，隐藏图片容器
            if (imagesContainer) imagesContainer.style.display = 'none';
            if (uploadArea) uploadArea.style.display = 'flex';
        }
    }
    
    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 全局卡片渲染器
const cardRenderer = new CardRenderer();

// 卡片管理类
class CardManager {
    constructor() {
        this.editingCardId = null;
    }

    // 创建新卡片（直接在主内容区添加）
    createNewCard(type = 'text') {
        // 创建一个临时的空白卡片，符合保存验证规范
        const tempCard = {
            id: 'temp_' + Date.now(),
            type: type,
            title: '',
            description: '',
            author: '', // 允许为空
            category: null, // 不属于任何分类，保存时会设为未分类
            models: [], // 允许为空
            websites: [], // 允许为空
            images: [],
            favorite: false,
            isTemporary: true, // 标记为临时卡片
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // 将临时卡片添加到列表前面
        appState.cards.unshift(tempCard);
        this.editingCardId = tempCard.id;

        // 重新渲染卡片
        cardRenderer.renderCards();

        // 自动进入编辑模式
        setTimeout(() => {
            const cardEl = document.querySelector(`[data-card-id="${tempCard.id}"]`);
            if (cardEl) {
                this.enterEditMode(cardEl, tempCard);
            }
        }, 100);
    }

    // 进入卡片编辑模式
    enterEditMode(cardEl, card) {
        // 检查是否已经在编辑模式
        if (cardEl.classList.contains('editing')) {
            return; // 已经在编辑模式，不重复添加
        }
        
        cardEl.classList.add('editing');

        const categorySelect = cardEl.querySelector('.card-category-select');
        if (categorySelect) {
            categorySelect.disabled = false;
        }
        
        // 替换标题为输入框
        const titleEl = cardEl.querySelector('.card-title');
        if (titleEl) {
            titleEl.innerHTML = `<input type="text" value="${this.escapeHtml(card.title)}" placeholder="请输入卡片标题" maxlength="100">`;
            const titleInput = titleEl.querySelector('input');
            titleInput.focus();
        }

        // 在编辑模式下显示图片删除按钮和封面设置
        const imageWrappers = cardEl.querySelectorAll('.card-image-section');
        imageWrappers.forEach(wrapper => {
            const deleteBtn = wrapper.querySelector('.delete-image-btn');
            if (deleteBtn) {
                deleteBtn.style.display = 'block';
            }
            const imgElement = wrapper.querySelector('img');
            if (imgElement) {
                const imagePath = imgElement.src.replace('file:///', ''); // 获取原始路径
                const isCover = card.images.find(img => img.path === imagePath)?.isCover;
                const setCoverBtn = document.createElement('button');
                setCoverBtn.className = 'set-cover-btn';
                setCoverBtn.innerHTML = `<i class="fas fa-star"></i>`;
                setCoverBtn.title = isCover ? '已是封面' : '设为封面';
                setCoverBtn.disabled = isCover;
                setCoverBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.setCoverImage(card.id, imagePath);
                };
                wrapper.appendChild(setCoverBtn);
            }
        });

        // 替换内容为文本域，并设置自动高度调整
        const descEl = cardEl.querySelector('.card-description');
        if (descEl) {
            const textarea = document.createElement('textarea');
            textarea.value = card.description || '';
            textarea.placeholder = '请输入提示词内容';
            textarea.style.minHeight = '100px';
            textarea.style.height = 'auto';
            
            descEl.innerHTML = '';
            descEl.appendChild(textarea);
            
            // 自动调整高度函数
            const autoResize = () => {
                textarea.style.height = 'auto';
                const scrollHeight = textarea.scrollHeight;
                const maxHeight = 400;
                textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
                
                // 如果内容超过最大高度，显示滚动条
                if (scrollHeight > maxHeight) {
                    textarea.style.overflowY = 'auto';
                } else {
                    textarea.style.overflowY = 'hidden';
                }
            };
            
            // 初始调整高度
            setTimeout(autoResize, 0);
            
            // 监听输入事件
            textarea.addEventListener('input', autoResize);
            textarea.addEventListener('paste', () => setTimeout(autoResize, 0));
        }

        // 替换作者为输入框
        const authorEl = cardEl.querySelector('.card-author');
        if (authorEl) {
            authorEl.innerHTML = `<input type="text" value="${this.escapeHtml(card.author)}" placeholder="请输入作者名称" maxlength="50">`;
        }

        // 添加模型管理区域
        const cardContent = cardEl.querySelector('.card-content');
        const cardFooter = cardEl.querySelector('.card-footer');
        
        if (cardContent) {
            const modelsSection = document.createElement('div');
            modelsSection.className = 'card-models-edit';
            modelsSection.innerHTML = `
                <div class="models-header">
                    <label>模型标签</label>
                </div>
                <div class="selected-models" id="selectedModelsCard-${card.id}">
                    ${(card.models || []).map(model => `
                        <span class="model-tag">
                            ${this.escapeHtml(model)}
                            <button type="button" class="remove-model" data-model="${this.escapeHtml(model)}">
                                <i class="fas fa-times"></i>
                            </button>
                        </span>
                    `).join('')}
                </div>
                <div class="add-model-section">
                    <input type="text" class="model-input" placeholder="添加模型" maxlength="30">
                    <button type="button" class="add-model-btn">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <div class="preset-models">
                    ${appState.presetModels.map(model => `
                        <span class="preset-model-tag" data-model="${this.escapeHtml(model)}">
                            ${this.escapeHtml(model)}
                        </span>
                    `).join('')}
                </div>
            `;
            
            // 在卡片操作按钮之前插入
            if (cardFooter) {
                cardContent.insertBefore(modelsSection, cardFooter);
            } else {
                cardContent.appendChild(modelsSection);
            }
            
            // 添加模型管理事件监听
            this.initializeModelManagement(modelsSection, card);
        }
        
        // 添加平台管理区域
        console.log('正在添加平台管理区域...');
        const platformsSection = document.createElement('div');
        platformsSection.className = 'card-platforms-edit';
        platformsSection.style.display = 'block'; // 确保显示
        platformsSection.innerHTML = `
            <div class="platforms-header">
                <label>平台标签</label>
            </div>
            <div class="selected-platforms" id="selectedPlatformsCard-${card.id}">
                ${(card.websites || []).map(website => `
                    <span class="platform-tag">
                        ${this.escapeHtml(website.name)}
                        <button type="button" class="remove-platform" data-platform="${this.escapeHtml(website.name)}">
                            <i class="fas fa-times"></i>
                        </button>
                    </span>
                `).join('')}
            </div>
            <div class="add-platform-section">
                <input type="text" class="platform-name-input" placeholder="平台名称" maxlength="30">
                <input type="url" class="platform-url-input" placeholder="平台链接" maxlength="200">
                <button type="button" class="add-platform-btn">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div class="preset-platforms">
                ${appState.presetPlatforms.map(platform => `
                    <span class="preset-platform-tag" data-platform="${this.escapeHtml(platform.name)}" data-url="${this.escapeHtml(platform.url)}">
                        ${this.escapeHtml(platform.name)}
                    </span>
                `).join('')}
            </div>
        `;
        
        // 在cardContent中插入平台管理区域
        if (cardContent) {
            if (cardFooter) {
                cardContent.insertBefore(platformsSection, cardFooter);
                console.log('平台管理区域已插入到cardFooter之前');
            } else {
                cardContent.appendChild(platformsSection);
                console.log('平台管理区域已添加到cardContent末尾');
            }
            
            // 添加平台管理事件监听
            console.log('初始化平台管理事件监听...');
            this.initializePlatformManagement(platformsSection, card);
        } else {
            console.error('cardContent 元素未找到，无法添加平台管理区域');
        }

        // 替换操作按钮
        const actionsEl = cardEl.querySelector('.card-actions');
        if (actionsEl) {
            actionsEl.innerHTML = `

                <button class="card-action-btn cancel-edit" title="退出编辑">
                    <i class="fas fa-times"></i> 退出编辑
                </button>
            `;
            
            // 添加实时更新事件监听
            this.setupLiveUpdate(cardEl, card);
            
            // 添加取消事件
            const cancelBtn = actionsEl.querySelector('.cancel-edit');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.saveAndExitEdit(card);
                });
            }
        }

        // 添加分类选择下拉菜单事件监听
        if (categorySelect) {
            categorySelect.addEventListener('change', (e) => {
                e.stopPropagation();
                const newCategory = e.target.value;
                card.category = newCategory;
                
                // 更新卡片数据
                const cardIndex = appState.cards.findIndex(c => c.id === card.id);
                if (cardIndex !== -1) {
                    appState.cards[cardIndex].category = newCategory;
                    appState.saveData();
                    uiManager.showNotification('分类已更新', 'success');
                    
                    // 实时刷新全局UI
                    cardRenderer.renderCards();
                    uiManager.updateCategoryCounts();
                    uiManager.renderTagClouds();
                }
            });
        }
        
        // 如果是图片卡片，不再在编辑模式中添加图片区域，因为已经在卡片创建时添加了
    }

    // 初始化模型管理
    initializeModelManagement(modelsSection, card) {
        const modelInput = modelsSection.querySelector('.model-input');
        const addModelBtn = modelsSection.querySelector('.add-model-btn');
        const selectedModels = modelsSection.querySelector('.selected-models');
        
        // 添加模型函数
        const addModel = () => {
            const modelName = modelInput.value.trim();
            if (!modelName) return;
            
            // 检查是否已存在
            if (card.models && card.models.includes(modelName)) {
                uiManager.showNotification('模型已存在', 'error');
                return;
            }
            
            // 添加到卡片数据
            if (!card.models) card.models = [];
            card.models.push(modelName);
            
            // 添加到自定义标签（如果不是预设模型）
            if (!appState.presetModels.includes(modelName) && !appState.customTags.models.includes(modelName)) {
                appState.customTags.models.push(modelName);
            }
            
            // 更新UI
            const modelTag = document.createElement('span');
            modelTag.className = 'model-tag';
            modelTag.innerHTML = `
                ${this.escapeHtml(modelName)}
                <button type="button" class="remove-model" data-model="${this.escapeHtml(modelName)}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            selectedModels.appendChild(modelTag);
            
            // 绑定删除事件
            const removeBtn = modelTag.querySelector('.remove-model');
            removeBtn.addEventListener('click', () => {
                const modelToRemove = removeBtn.dataset.model;
                card.models = card.models.filter(m => m !== modelToRemove);
                modelTag.remove();
                
                // 实时刷新全局UI
                cardRenderer.renderCards();
                uiManager.updateCategoryCounts();
                uiManager.renderTagClouds();
            });
            
            modelInput.value = '';
        };
        
        // 事件监听
        if (addModelBtn) {
            addModelBtn.addEventListener('click', addModel);
        }
        
        if (modelInput) {
            modelInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addModel();
                }
            });
        }
        
        // 预设模型点击事件
        const presetModelTags = modelsSection.querySelectorAll('.preset-model-tag');
        presetModelTags.forEach(tag => {
            tag.addEventListener('click', () => {
                const modelName = tag.dataset.model;
                if (modelInput) {
                    modelInput.value = modelName;
                    addModel();
                }
            });
        });
        
        // 初始化删除按钮事件
            selectedModels.querySelectorAll('.remove-model').forEach(btn => {
                btn.addEventListener('click', () => {
                    const modelToRemove = btn.dataset.model;
                    card.models = card.models.filter(m => m !== modelToRemove);
                    btn.closest('.model-tag').remove();
                    
                    // 实时刷新全局UI
                    cardRenderer.renderCards();
                    uiManager.updateCategoryCounts();
                    uiManager.renderTagClouds();
                });
            });
    }

    // 初始化平台管理
    initializePlatformManagement(platformsSection, card) {
        const platformNameInput = platformsSection.querySelector('.platform-name-input');
        const platformUrlInput = platformsSection.querySelector('.platform-url-input');
        const addPlatformBtn = platformsSection.querySelector('.add-platform-btn');
        const selectedPlatforms = platformsSection.querySelector('.selected-platforms');
        
        // 添加平台函数
        const addPlatform = () => {
            const platformName = platformNameInput.value.trim();
            const platformUrl = platformUrlInput.value.trim();
            
            if (!platformName) {
                uiManager.showNotification('请输入平台名称', 'error');
                return;
            }
            
            // 检查是否已存在
            if (card.websites && card.websites.some(w => w.name === platformName)) {
                uiManager.showNotification('平台已存在', 'error');
                return;
            }
            
            // 添加到卡片数据
            if (!card.websites) card.websites = [];
            card.websites.push({ name: platformName, url: platformUrl || '#' });
            
            // 添加到自定义标签（如果不是预设平台）
            const presetPlatformNames = appState.presetPlatforms.map(p => p.name);
            if (!presetPlatformNames.includes(platformName) && !appState.customTags.platforms.includes(platformName)) {
                appState.customTags.platforms.push(platformName);
                if (platformUrl) {
                    appState.presetPlatforms.push({ name: platformName, url: platformUrl });
                }
            }
            
            // 更新UI
            const platformTag = document.createElement('span');
            platformTag.className = 'platform-tag';
            platformTag.innerHTML = `
                ${this.escapeHtml(platformName)}
                <button type="button" class="remove-platform" data-platform="${this.escapeHtml(platformName)}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            selectedPlatforms.appendChild(platformTag);
            
            // 绑定删除事件
            const removeBtn = platformTag.querySelector('.remove-platform');
            removeBtn.addEventListener('click', () => {
                const platformToRemove = removeBtn.dataset.platform;
                card.websites = card.websites.filter(w => w.name !== platformToRemove);
                platformTag.remove();
                
                // 实时刷新全局UI
                cardRenderer.renderCards();
                uiManager.updateCategoryCounts();
                uiManager.renderTagClouds();
            });
            
            platformNameInput.value = '';
            platformUrlInput.value = '';
        };
        
        // 事件监听
        if (addPlatformBtn) {
            addPlatformBtn.addEventListener('click', addPlatform);
        }
        
        if (platformNameInput) {
            platformNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (platformUrlInput) {
                        platformUrlInput.focus();
                    } else {
                        addPlatform();
                    }
                }
            });
        }
        
        if (platformUrlInput) {
            platformUrlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addPlatform();
                }
            });
        }
        
        // 预设平台点击事件
        const presetPlatformTags = platformsSection.querySelectorAll('.preset-platform-tag');
        presetPlatformTags.forEach(tag => {
            tag.addEventListener('click', () => {
                const platformName = tag.dataset.platform;
                const platformUrl = tag.dataset.url;
                if (platformNameInput) {
                    platformNameInput.value = platformName;
                }
                if (platformUrlInput && platformUrl) {
                    platformUrlInput.value = platformUrl;
                }
                addPlatform();
            });
        });
        
        // 初始化删除按钮事件
        selectedPlatforms.querySelectorAll('.remove-platform').forEach(btn => {
            btn.addEventListener('click', () => {
                const platformToRemove = btn.dataset.platform;
                card.websites = card.websites.filter(w => w.name !== platformToRemove);
                btn.closest('.platform-tag').remove();
                
                // 实时刷新全局UI
                cardRenderer.renderCards();
                uiManager.updateCategoryCounts();
                uiManager.renderTagClouds();
            });
        });
    }

    // 从编辑模式保存卡片
    saveCardFromEditMode(cardEl, card) {
        const titleInput = cardEl.querySelector('.card-title input');
        const descTextarea = cardEl.querySelector('.card-description textarea');
        const authorInput = cardEl.querySelector('.card-author input');
        
        const title = titleInput ? titleInput.value.trim() : '';
        const description = descTextarea ? descTextarea.value.trim() : '';
        const author = authorInput ? authorInput.value.trim() : '';
        
        // 根据规范：只验证标题字段，其他字段可为空
        if (!title) {
            uiManager.showNotification('请输入卡片标题', 'error');
            if (titleInput) titleInput.focus();
            return;
        }

        // 如果没有选择分类，保持为'未分类'状态
        if (!card.category) {
            card.category = 'uncategorized';
        }
        
        // 更新卡片数据（允许作者、模型、平台为空）
        const updatedCard = {
            ...card,
            title,
            description: description || '', // 允许为空
            author: author || '', // 允许为空
            models: card.models || [], // 保持现有或空数组
            websites: card.websites || [], // 保持现有或空数组
            updatedAt: new Date().toISOString()
        };
        
        if (card.isTemporary) {
            // 如果是临时卡片，则创建新卡片
            delete updatedCard.isTemporary;
            updatedCard.id = Date.now().toString();
            
            // 移除临时卡片
            const tempIndex = appState.cards.findIndex(c => c.id === card.id);
            if (tempIndex !== -1) {
                appState.cards.splice(tempIndex, 1);
            }
            
            // 添加新卡片
            appState.addCard(updatedCard);
            uiManager.showNotification('卡片已创建', 'success');
        } else {
            // 更新现有卡片
            appState.updateCard(card.id, updatedCard);
            uiManager.showNotification('卡片已更新', 'success');
        }
        
        this.cleanupLiveUpdate(cardEl);
    }

    // 设置实时更新
    setupLiveUpdate(cardEl, card) {
        const titleInput = cardEl.querySelector('.card-title input');
        const descTextarea = cardEl.querySelector('.card-description textarea');
        const authorInput = cardEl.querySelector('.card-author input');
        
        // 更新延迟计时器
        let updateTimeout;
        const updateDelay = 500; // 0.5秒后更新
        
        // 更新函数
        const liveUpdate = () => {
             clearTimeout(updateTimeout);
             updateTimeout = setTimeout(() => {
                 this.updateCardData(cardEl, card);
             }, updateDelay);
          };
        
        // 监听输入变化
        if (titleInput) {
            titleInput.addEventListener('input', liveUpdate);
        }
        if (descTextarea) {
            descTextarea.addEventListener('input', liveUpdate);
        }
        if (authorInput) {
            authorInput.addEventListener('input', liveUpdate);
        }
        
        // 监听模型和平台的变化
        const observer = new MutationObserver(liveUpdate);
        
        const modelsSection = cardEl.querySelector('.card-models-edit');
        const platformsSection = cardEl.querySelector('.card-platforms-edit');
        
        if (modelsSection) {
            observer.observe(modelsSection, { childList: true, subtree: true });
        }
        if (platformsSection) {
            observer.observe(platformsSection, { childList: true, subtree: true });
        }
        
        // 保存观察者和计时器引用，以便清理
        cardEl._liveUpdateObserver = observer;
        cardEl._liveUpdateTimeout = updateTimeout;
    }

    // 实时更新卡片数据（不保存）
    updateCardData(cardEl, card) {
        const titleInput = cardEl.querySelector('.card-title input');
        const descTextarea = cardEl.querySelector('.card-description textarea');
        const authorInput = cardEl.querySelector('.card-author input');
        
        card.title = titleInput ? titleInput.value.trim() : '';
        card.description = descTextarea ? descTextarea.value.trim() : '';
        card.author = authorInput ? authorInput.value.trim() : '';
        card.updatedAt = new Date().toISOString();
    }

    // 清理实时更新
    cleanupLiveUpdate(cardEl) {
        if (cardEl._liveUpdateObserver) {
            cardEl._liveUpdateObserver.disconnect();
            delete cardEl._liveUpdateObserver;
        }
        if (cardEl._liveUpdateTimeout) {
            clearTimeout(cardEl._liveUpdateTimeout);
            delete cardEl._liveUpdateTimeout;
        }
    }

    // 清理自动保存
    cleanupAutoSave(cardEl) {
        if (cardEl._autoSaveObserver) {
            cardEl._autoSaveObserver.disconnect();
            delete cardEl._autoSaveObserver;
        }
        if (cardEl._autoSaveTimeout) {
            clearTimeout(cardEl._autoSaveTimeout);
            delete cardEl._autoSaveTimeout;
        }
    }

    // 保存并退出编辑
    saveAndExitEdit(card) {
        const cardEl = document.querySelector(`[data-card-id="${card.id}"]`);
        if (cardEl) {
            this.cleanupLiveUpdate(cardEl);
            this.saveCardFromEditMode(cardEl, card);
        }
        
        const categorySelect = cardEl.querySelector('.card-category-select');
        if (categorySelect) {
            categorySelect.disabled = true;
        }
        if (cardEl) {
            cardEl.classList.remove('editing');
        }
        this.editingCardId = null;
        cardRenderer.renderCards();
    }

    // 设置封面图片
    setCoverImage(cardId, imagePath) {
        const card = appState.cards.find(c => c.id === cardId);
        if (card) {
            card.images.forEach(img => {
                img.isCover = (img.path === imagePath);
            });
            appState.saveData();
            cardRenderer.renderCards();
            uiManager.showNotification('封面已设置', 'success');
        }
    }

    // 删除图片
    deleteImage(cardId, imagePath) {
        const card = appState.cards.find(c => c.id === cardId);
        if (card) {
            const initialImageCount = card.images.length;
            card.images = card.images.filter(img => img.path !== imagePath);
            
            // 如果删除的是封面，且还有其他图片，则设置第一张为封面
            if (initialImageCount > card.images.length && card.images.length > 0) {
                const deletedImageWasCover = !card.images.some(img => img.isCover);
                if (deletedImageWasCover) {
                    card.images[0].isCover = true;
                }
            }
            appState.saveData();
            cardRenderer.renderCards();
            uiManager.showNotification('图片已删除', 'success');
        }
    }

    // 为卡片显示分类选择
    showCategorySelectForCard(card) {
        const modal = uiManager.showModal('categorySelectModalTemplate');
        if (!modal) return;

        const categoryList = modal.querySelector('.category-list');
        if (!categoryList) return;

        categoryList.innerHTML = '';
        appState.folders.forEach(folder => {
            const optionEl = document.createElement('div');
            optionEl.className = 'category-option';
            if (folder.id === card.category) {
                optionEl.classList.add('selected');
            }
            
            optionEl.innerHTML = `
                <i class="${folder.icon}"></i>
                <span>${folder.name}</span>
            `;
            
            optionEl.addEventListener('click', () => {
                card.category = folder.id;
                
                // 更新卡片显示
                const cardEl = document.querySelector(`[data-card-id="${card.id}"]`);
                if (cardEl) {
                    const categoryBtn = cardEl.querySelector('.card-category');
                    if (categoryBtn) {
                        categoryBtn.textContent = folder.name;
                    }
                }
                
                uiManager.closeModal();
            });
            
            categoryList.appendChild(optionEl);
        });
    }

    // 转义HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    // 初始化图片上传功能
    initializeImageUpload(modal) {
        const imageUploadArea = modal.querySelector('.image-upload-area');
        const imageUploadInput = modal.querySelector('#imageUpload');
        
        if (!imageUploadArea || !imageUploadInput) return;
        
        // 点击上传
        imageUploadArea.addEventListener('click', () => {
            imageUploadInput.click();
        });
        
        // 文件选择
        imageUploadInput.addEventListener('change', (e) => {
            this.handleImageFiles(e.target.files, cardEl);
        });
        
        // 拖拽上传
        imageUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageUploadArea.classList.add('dragover');
        });
        
        imageUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            imageUploadArea.classList.remove('dragover');
        });
        
        imageUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            imageUploadArea.classList.remove('dragover');
            this.handleImageFiles(e.dataTransfer.files, cardEl);
        });
    }
    
    // 显示创建卡片模态框
    showCreateCardModal(type = 'text') {
        const modal = uiManager.showModal('cardModalTemplate');
        if (!modal) return;

        const title = modal.querySelector('.card-modal-title');
        const imageSection = modal.querySelector('.image-section');
        const saveBtn = modal.querySelector('.modal-save');
        
        if (title) title.textContent = type === 'image' ? '创建图片卡片' : '创建文本卡片';
        if (imageSection) imageSection.style.display = type === 'image' ? 'block' : 'none';
        
        this.initializeCardForm(modal, { type });
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveCard(modal);
            });
        }
    }

    // 显示编辑卡片模态框
    showEditCardModal(card) {
        const modal = uiManager.showModal('cardModalTemplate');
        if (!modal) return;

        const title = modal.querySelector('.card-modal-title');
        const imageSection = modal.querySelector('.image-section');
        const saveBtn = modal.querySelector('.modal-save');
        
        if (title) title.textContent = '编辑卡片';
        if (imageSection) imageSection.style.display = card.type === 'image' ? 'block' : 'none';
        
        this.initializeCardForm(modal, card);
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveCard(modal, card.id);
            });
        }
    }

    // 初始化卡片表单
    initializeCardForm(modal, cardData) {
        const titleInput = modal.querySelector('#cardTitle');
        const descriptionInput = modal.querySelector('#cardDescription');
        const authorInput = modal.querySelector('#cardAuthor');
        const categoryBtn = modal.querySelector('#selectCategory');
        
        // 填充表单数据
        if (titleInput) titleInput.value = cardData.title || '';
        if (descriptionInput) descriptionInput.value = cardData.description || '';
        if (authorInput) authorInput.value = cardData.author || '';
        
        // 设置当前分类
        this.currentCategory = cardData.category || 'ai-chat';
        this.updateCategoryButton(modal);
        
        // 初始化模型和网站
        this.initializeModelsSection(modal, cardData.models || []);
        this.initializeWebsitesSection(modal, cardData.websites || []);
        
        // 初始化图片（如果是图片卡片）
        if (cardData.type === 'image') {
            this.initializeImagesSection(modal, cardData.images || []);
        }
        
        // 添加事件监听
        this.addCardFormEventListeners(modal);
    }

    // 添加表单事件监听
    addCardFormEventListeners(modal) {
        // 分类选择
        const categoryBtn = modal.querySelector('#selectCategory');
        if (categoryBtn) {
            categoryBtn.addEventListener('click', () => {
                this.showCategorySelectModal();
            });
        }
        
        // 复制内容按钮
        const copyBtn = modal.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const content = modal.querySelector('#cardDescription').value;
                uiManager.copyToClipboard(content);
            });
        }
        
        // 模型管理
        const addModelBtn = modal.querySelector('#addModel');
        const modelInput = modal.querySelector('#modelInput');
        
        if (addModelBtn && modelInput) {
            const addModel = () => {
                const modelName = modelInput.value.trim();
                if (modelName) {
                    this.addModelToCard(modal, modelName);
                    modelInput.value = '';
                }
            };
            
            addModelBtn.addEventListener('click', addModel);
            modelInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addModel();
                }
            });
        }
        
        // 网站管理
        const addWebsiteBtn = modal.querySelector('#addWebsite');
        const websiteNameInput = modal.querySelector('#websiteNameInput');
        const websiteUrlInput = modal.querySelector('#websiteUrlInput');
        
        if (addWebsiteBtn && websiteNameInput && websiteUrlInput) {
            const addWebsite = () => {
                const name = websiteNameInput.value.trim();
                const url = websiteUrlInput.value.trim();
                if (name && url) {
                    this.addWebsiteToCard(modal, { name, url });
                    websiteNameInput.value = '';
                    websiteUrlInput.value = '';
                }
            };
            
            addWebsiteBtn.addEventListener('click', addWebsite);
            websiteNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    websiteUrlInput.focus();
                }
            });
            websiteUrlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addWebsite();
                }
            });
        }
    }

    // 保存卡片
    saveCard(modal, cardId = null) {
        const titleInput = modal.querySelector('#cardTitle');
        const descriptionInput = modal.querySelector('#cardDescription');
        const authorInput = modal.querySelector('#cardAuthor');
        
        const cardData = {
            title: titleInput.value.trim(),
            description: descriptionInput.value.trim(),
            author: authorInput.value.trim(),
            category: this.currentCategory,
            models: this.getCurrentModels(modal),
            websites: this.getCurrentWebsites(modal)
        };
        
        // 验证表单
        if (!cardData.title) {
            uiManager.showNotification('请输入卡片标题', 'error');
            titleInput.focus();
            return;
        }
        
        if (!cardData.description) {
            uiManager.showNotification('请输入卡片内容', 'error');
            descriptionInput.focus();
            return;
        }
        
        if (cardId) {
            // 更新卡片
            appState.updateCard(cardId, cardData);
            uiManager.showNotification('卡片已更新', 'success');
        } else {
            // 创建新卡片
            appState.addCard(cardData);
            uiManager.showNotification('卡片已创建', 'success');
        }
        
        uiManager.closeModal();
        cardRenderer.renderCards();
        uiManager.updateCategoryCounts();
        uiManager.renderTagClouds();
    }

    // 获取当前模型列表
    getCurrentModels(modal) {
        const selectedModels = modal.querySelector('#selectedModels');
        const modelTags = selectedModels.querySelectorAll('.selected-tag');
        return Array.from(modelTags).map(tag => tag.dataset.value);
    }

    // 获取当前网站列表
    getCurrentWebsites(modal) {
        const selectedWebsites = modal.querySelector('#selectedWebsites');
        const websiteTags = selectedWebsites.querySelectorAll('.selected-website');
        return Array.from(websiteTags).map(tag => ({
            name: tag.dataset.name,
            url: tag.dataset.url
        }));
    }

    // 更新分类按钮
    updateCategoryButton(modal) {
        const categoryBtn = modal.querySelector('#selectCategory');
        const categoryName = modal.querySelector('.category-name');
        
        if (categoryBtn && categoryName) {
            const folder = appState.folders.find(f => f.id === this.currentCategory);
            categoryName.textContent = folder ? folder.name : '未分类';
        }
    }

    // 显示分类选择模态框
    showCategorySelectModal() {
        const modal = uiManager.showModal('categorySelectModalTemplate');
        if (!modal) return;

        const categoryList = modal.querySelector('.category-list');
        if (!categoryList) return;

        categoryList.innerHTML = '';
        appState.folders.forEach(folder => {
            const optionEl = document.createElement('div');
            optionEl.className = 'category-option';
            if (folder.id === this.currentCategory) {
                optionEl.classList.add('selected');
            }
            
            optionEl.innerHTML = `
                <i class="${folder.icon}"></i>
                <span>${folder.name}</span>
            `;
            
            optionEl.addEventListener('click', () => {
                this.currentCategory = folder.id;
                const modal = document.querySelector('.modal-overlay');
                if (modal) {
                    this.updateCategoryButton(modal.closest('.modal'));
                }
                uiManager.closeModal();
            });
            
            categoryList.appendChild(optionEl);
        });
    }

    // 初始化模型区域
    initializeModelsSection(modal, models = []) {
        const selectedModels = modal.querySelector('#selectedModels');
        const presetModels = modal.querySelector('#presetModels');
        
        if (!selectedModels || !presetModels) return;
        
        // 清空并添加已选择的模型
        selectedModels.innerHTML = '';
        models.forEach(model => {
            this.addModelToCard(modal, model);
        });
        
        // 渲染预设模型
        presetModels.innerHTML = '';
        appState.presetModels.forEach(model => {
            const tagEl = document.createElement('div');
            tagEl.className = 'preset-tag';
            tagEl.textContent = model;
            tagEl.addEventListener('click', () => {
                this.addModelToCard(modal, model);
            });
            presetModels.appendChild(tagEl);
        });
    }

    // 初始化网站区域
    initializeWebsitesSection(modal, websites = []) {
        const selectedWebsites = modal.querySelector('#selectedWebsites');
        const presetWebsites = modal.querySelector('#presetWebsites');
        
        if (!selectedWebsites || !presetWebsites) return;
        
        // 清空并添加已选择的网站
        selectedWebsites.innerHTML = '';
        websites.forEach(website => {
            this.addWebsiteToCard(modal, website);
        });
        
        // 渲染预设网站
        presetWebsites.innerHTML = '';
        appState.presetPlatforms.forEach(platform => {
            const tagEl = document.createElement('div');
            tagEl.className = 'preset-website';
            tagEl.textContent = platform.name;
            tagEl.addEventListener('click', () => {
                this.addWebsiteToCard(modal, platform);
            });
            presetWebsites.appendChild(tagEl);
        });
    }

    // 初始化图片区域
    initializeImagesSection(modal, images = []) {
        const uploadedImages = modal.querySelector('.uploaded-images');
        if (!uploadedImages) return;
        
        uploadedImages.innerHTML = '';
        images.forEach(image => {
            // 简化处理，实际应用中需要渲染图片缩略图
        });
    }

    // 添加模型到卡片
    addModelToCard(modal, modelName) {
        const selectedModels = modal.querySelector('#selectedModels');
        if (!selectedModels) return;
        
        // 检查是否已存在
        const existing = selectedModels.querySelector(`[data-value="${modelName}"]`);
        if (existing) return;
        
        const tagEl = document.createElement('div');
        tagEl.className = 'selected-tag';
        tagEl.dataset.value = modelName;
        tagEl.innerHTML = `
            <span>${modelName}</span>
            <button class="tag-remove-btn" type="button">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        const removeBtn = tagEl.querySelector('.tag-remove-btn');
        removeBtn.addEventListener('click', () => {
            tagEl.remove();
        });
        
        selectedModels.appendChild(tagEl);
    }

    // 添加网站到卡片
    addWebsiteToCard(modal, website) {
        const selectedWebsites = modal.querySelector('#selectedWebsites');
        if (!selectedWebsites) return;
        
        // 检查是否已存在
        const existing = selectedWebsites.querySelector(`[data-name="${website.name}"]`);
        if (existing) return;
        
        const tagEl = document.createElement('div');
        tagEl.className = 'selected-website';
        tagEl.dataset.name = website.name;
        tagEl.dataset.url = website.url;
        tagEl.innerHTML = `
            <span>${website.name}</span>
            <button class="website-remove-btn" type="button">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        const removeBtn = tagEl.querySelector('.website-remove-btn');
        removeBtn.addEventListener('click', () => {
            tagEl.remove();
        });
        
        selectedWebsites.appendChild(tagEl);
    }

    // 查看图片大图
    viewImage(cardId, imagePath) {
        const card = appState.cards.find(c => c.id === cardId);
        if (!card || !card.images || card.images.length === 0) return;

        // 创建图片查看器模态框
        const modalTemplate = document.getElementById('imageViewerModalTemplate');
        if (!modalTemplate) {
            console.error('图片查看器模板未找到');
            return;
        }

        const modalClone = modalTemplate.content.cloneNode(true);
        const modal = modalClone.querySelector('.image-viewer-overlay');
        document.body.appendChild(modal);

        // 初始化图片查看器
        this.initializeImageViewer(modal, card, imagePath);
    }

    // 初始化图片查看器
    initializeImageViewer(modal, card, currentImagePath) {
        const viewerImage = modal.querySelector('#viewerImage');
        const imageName = modal.querySelector('#imageName');
        const imageSize = modal.querySelector('#imageSize');
        const imageIndex = modal.querySelector('#imageIndex');
        const closeBtn = modal.querySelector('.modal-close');
        const prevBtn = modal.querySelector('.prev-btn');
        const nextBtn = modal.querySelector('.next-btn');
        const zoomInBtn = modal.querySelector('.zoom-in-btn');
        const zoomOutBtn = modal.querySelector('.zoom-out-btn');
        const resetBtn = modal.querySelector('.reset-zoom-btn');
        const downloadBtn = modal.querySelector('.download-btn');

        // 找到当前图片的索引
        let currentIndex = card.images.findIndex(img => img.path === currentImagePath);
        if (currentIndex === -1) currentIndex = 0;

        // 显示当前图片
        this.showImageInViewer(viewerImage, card.images[currentIndex], imageName, imageSize, imageIndex, currentIndex, card.images.length);

        // 事件监听
        closeBtn.addEventListener('click', () => {
            uiManager.closeModal();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                uiManager.closeModal();
                // 移除键盘事件监听器
                document.removeEventListener('keydown', handleKeydown);
            }
        });
        
        // 保存键盘事件处理函数的引用
        const handleKeydown = function(e) {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleKeydown);
            } else if (e.key === 'ArrowLeft') {
                currentIndex = (currentIndex - 1 + card.images.length) % card.images.length;
                this.showImageInViewer(viewerImage, card.images[currentIndex], imageName, imageSize, imageIndex, currentIndex, card.images.length);
            } else if (e.key === 'ArrowRight') {
                currentIndex = (currentIndex + 1) % card.images.length;
                this.showImageInViewer(viewerImage, card.images[currentIndex], imageName, imageSize, imageIndex, currentIndex, card.images.length);
            }
        }.bind(this);
        
        // 添加键盘事件监听器
        document.addEventListener('keydown', handleKeydown);
        
        // 导航按钮
        prevBtn.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + card.images.length) % card.images.length;
            this.showImageInViewer(viewerImage, card.images[currentIndex], imageName, imageSize, imageIndex, currentIndex, card.images.length);
        });

        nextBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % card.images.length;
            this.showImageInViewer(viewerImage, card.images[currentIndex], imageName, imageSize, imageIndex, currentIndex, card.images.length);
        });

        // 缩放控制
        let scale = 1;
        zoomInBtn.addEventListener('click', () => {
            scale = Math.min(scale + 0.2, 3);
            viewerImage.style.transform = `scale(${scale})`;
        });

        zoomOutBtn.addEventListener('click', () => {
            scale = Math.max(scale - 0.2, 0.5);
            viewerImage.style.transform = `scale(${scale})`;
        });

        resetBtn.addEventListener('click', () => {
            scale = 1;
            viewerImage.style.transform = 'scale(1)';
        });

        // 下载功能
        downloadBtn.addEventListener('click', () => {
            this.downloadImage(card.images[currentIndex]);
        });
    }

    // 在查看器中显示图片
    showImageInViewer(viewerImage, imageData, imageName, imageSize, imageIndex, currentIndex, totalImages) {
        let imageSrc;
        if (imageData.path && imageData.path.startsWith('data:')) {
            imageSrc = imageData.path;
        } else if (imageData.path) {
            imageSrc = `file://${imageData.path}`;
        } else {
            console.error('无效的图片路径:', imageData);
            return;
        }

        viewerImage.src = imageSrc;
        imageName.textContent = imageData.name || '未命名图片';
        imageSize.textContent = this.formatFileSize(imageData.size || 0);
        imageIndex.textContent = `${currentIndex + 1} / ${totalImages}`;
    }

    // 下载图片
    async downloadImage(imageData) {
        try {
            // 获取下载目录
            const downloadPath = await ipcRenderer.invoke('get-download-directory');
            
            if (imageData.path && imageData.path.startsWith('data:')) {
                // 处理data URL
                const base64Data = imageData.path.split(',')[1];
                const buffer = Buffer.from(base64Data, 'base64');
                const fileName = imageData.name || `image_${Date.now()}.png`;
                const filePath = path.join(downloadPath, fileName);
                
                fs.writeFileSync(filePath, buffer);
                uiManager.showNotification(`图片已保存至: ${filePath}`, 'success');
                
                // 在文件管理器中显示
                await ipcRenderer.invoke('show-item-in-folder', filePath);
                
            } else if (imageData.path) {
                // 处理文件路径
                const fileName = imageData.name || path.basename(imageData.path) || `image_${Date.now()}.png`;
                const destPath = path.join(downloadPath, fileName);
                
                // 复制文件
                fs.copyFileSync(imageData.path, destPath);
                uiManager.showNotification(`图片已保存至: ${destPath}`, 'success');
                
                // 在文件管理器中显示
                await ipcRenderer.invoke('show-item-in-folder', destPath);
            } else {
                uiManager.showNotification('无法下载图片: 无效的图片路径', 'error');
            }
        } catch (error) {
            console.error('下载图片失败:', error);
            uiManager.showNotification(`下载图片失败: ${error.message}`, 'error');
        }
    }
    
    // 截图卡片
    async captureCardScreenshot(cardId, cardElement) {
        try {
            // 检查是否设置了截图保存路径
            if (!appState.settings.screenshotPath) {
                uiManager.showNotification('请先在设置中设置截图保存路径', 'warning');
                uiManager.showSettingsModal();
                return;
            }
            
            // 获取卡片数据
            const card = appState.getCardById(cardId);
            if (!card) {
                uiManager.showNotification('无法找到卡片数据', 'error');
                return;
            }
            
            // 显示加载状态
            uiManager.showNotification('正在截图...', 'info');
            
            // 调用主进程进行截图
            const result = await ipcRenderer.invoke('capture-card-screenshot', { cardId });
            
            if (result.success) {
                // 生成文件名
                const fileName = `card_${cardId}_${Date.now()}.png`;
                const destPath = path.join(appState.settings.screenshotPath, fileName);
                
                // 将Base64数据转换为Buffer并保存
                const buffer = Buffer.from(result.data, 'base64');
                fs.writeFileSync(destPath, buffer);
                
                uiManager.showNotification(`截图已保存至: ${destPath}`, 'success');
                
                // 在文件管理器中显示
                await ipcRenderer.invoke('show-item-in-folder', destPath);
            } else {
                uiManager.showNotification(`截图失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('卡片截图失败:', error);
            uiManager.showNotification(`截图失败: ${error.message}`, 'error');
        }
    }
}

// 全局卡片管理器
const cardManager = new CardManager();

// 主初始化函数
async function initializeApp() {
    try {
        console.log('开始初始化应用...');
        
        // 加载数据
        await appState.loadData();
        console.log('数据加载完成');
        
        // 初始化UI
        uiManager.renderSidebar();
        console.log('侧边栏渲染完成');
        
        uiManager.renderTagClouds();
        console.log('标签云渲染完成');
        
        cardRenderer.renderCards();
        console.log('卡片渲染完成');
        
        // 初始化事件监听
        initializeEventListeners();
        console.log('事件监听初始化完成');
        
        // 初始化全局拖拽事件处理
        initializeGlobalDragHandling();
        console.log('全局拖拽事件初始化完成');
        
        uiManager.showNotification('应用初始化完成', 'success');
        console.log('应用初始化完成');
    } catch (error) {
        console.error('初始化失败:', error);
        uiManager.showNotification('初始化失败: ' + error.message, 'error');
    }
}

// 初始化事件监听
function initializeEventListeners() {
    console.log('开始初始化事件监听器...');
    
    // 搜索功能
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearch');
    
    if (searchInput) {
        console.log('初始化搜索功能');
        searchInput.addEventListener('input', (e) => {
            appState.searchQuery = e.target.value;
            cardRenderer.renderCards();
            
            if (clearSearchBtn) {
                clearSearchBtn.style.display = appState.searchQuery ? 'block' : 'none';
            }
        });
    } else {
        console.error('未找到搜索输入框');
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                appState.searchQuery = '';
                cardRenderer.renderCards();
                clearSearchBtn.style.display = 'none';
            }
        });
    }
    
    // 顶部按钮
    const createTextBtn = document.getElementById('createTextCard');
    const createImageBtn = document.getElementById('createImageCard');
    const settingsBtn = document.getElementById('settingsBtn');
    
    if (createTextBtn) {
        console.log('初始化创建文本卡片按钮');
        createTextBtn.addEventListener('click', () => {
            console.log('点击创建文本卡片');
            cardManager.createNewCard('text');
        });
    } else {
        console.error('未找到创建文本卡片按钮');
    }
    
    if (createImageBtn) {
        console.log('初始化创建图片卡片按钮');
        createImageBtn.addEventListener('click', () => {
            console.log('点击创建图片卡片');
            cardManager.createNewCard('image');
        });
    } else {
        console.error('未找到创建图片卡片按钮');
    }
    
    if (settingsBtn) {
        console.log('初始化设置按钮');
        settingsBtn.addEventListener('click', () => {
            console.log('点击设置按钮');
            showSettingsModal();
        });
    } else {
        console.error('未找到设置按钮');
    }
    
    // 侧边栏菜单事件监听
    setTimeout(() => {
        const menuItems = document.querySelectorAll('.menu-item');
        console.log(`找到 ${menuItems.length} 个菜单项`);
        
        menuItems.forEach((item, index) => {
            console.log(`初始化菜单项 ${index + 1}: ${item.dataset.category}`);
            
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const category = this.dataset.category;
                console.log(`点击菜单项: ${category}`);
                
                if (category) {
                    uiManager.selectCategory(category);
                }
            });
        });
        
        console.log('侧边栏菜单事件监听初始化完成');
    }, 200);
    
    // 添加文件夹按钮
    const addFolderBtn = document.getElementById('addFolder');
    if (addFolderBtn) {
        console.log('初始化添加文件夹按钮');
        addFolderBtn.addEventListener('click', () => {
            console.log('点击添加文件夹');
            showCreateFolderModal();
        });
    } else {
        console.error('未找到添加文件夹按钮');
    }
    
    // 标签管理按钮
    const manageModelsBtn = document.getElementById('manageModels');
    const managePlatformsBtn = document.getElementById('managePlatforms');
    
    if (manageModelsBtn) {
        console.log('初始化模型管理按钮');
        manageModelsBtn.addEventListener('click', () => {
            console.log('点击模型管理');
            showTagManagementModal('models');
        });
    } else {
        console.error('未找到模型管理按钮');
    }
    
    if (managePlatformsBtn) {
        console.log('初始化平台管理按钮');
        managePlatformsBtn.addEventListener('click', () => {
            console.log('点击平台管理');
            showTagManagementModal('platforms');
        });
    } else {
        console.error('未找到平台管理按钮');
    }
    
    // 视图控制
    const gridViewBtn = document.getElementById('gridView');
    const sortBtn = document.getElementById('sortBtn');
    const sortMenu = document.getElementById('sortMenu');
    const sortOrderBtn = document.getElementById('sortOrderBtn');
    
    if (gridViewBtn) {
        console.log('初始化视图控制按钮');
    } else {
        console.error('未找到视图控制按钮');
    }
    
    // 排序功能优化
    const sortButton = document.getElementById('sortButton');
    const sortDropdownMenu = document.getElementById('sortDropdownMenu');
    const sortLabel = document.getElementById('sortLabel');
    
    function toggleSortMenu(show) {
        if (!sortDropdownMenu) return;
        
        const isVisible = sortDropdownMenu.classList.contains('show');
        const shouldShow = show !== undefined ? show : !isVisible;
        
        if (shouldShow) {
            sortDropdownMenu.classList.add('show');
        } else {
            sortDropdownMenu.classList.remove('show');
        }
        
        // 更新箭头方向
        const icon = sortButton?.querySelector('.fa-caret-down, .fa-caret-up');
        if (icon) {
            icon.className = shouldShow ? 'fas fa-caret-up' : 'fas fa-caret-down';
        }
    }
    
    if (sortButton) {
        sortButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSortMenu();
        });
        
        // 防止双击选中文本
        sortButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
    }
    
    if (sortDropdownMenu) {
        // 排序选项点击事件
        const sortItems = sortDropdownMenu.querySelectorAll('.sort-item');
        sortItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const sortBy = e.target.dataset.sort;
                if (sortBy) {
                    appState.sortBy = sortBy;
                    cardRenderer.renderCards();
                    
                    // 更新标签文本
                    if (sortLabel) {
                        sortLabel.textContent = sortBy === 'date' ? '按日期' : '按标题';
                    }
                    
                    // 关闭菜单
                    toggleSortMenu(false);
                }
            });
            
            // 防止选中文本
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });
        });
    }
    
    if (sortOrderBtn) {
        sortOrderBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            appState.sortOrder = appState.sortOrder === 'asc' ? 'desc' : 'asc';
            
            // 添加点击动画
            sortOrderBtn.style.transform = 'scale(0.9)';
            setTimeout(() => {
                sortOrderBtn.style.transform = '';
            }, 100);
            
            // 更新图标
            const icon = sortOrderBtn.querySelector('i');
            if (icon) {
                icon.className = appState.sortOrder === 'asc' ? 'fas fa-sort-amount-up' : 'fas fa-sort-amount-down';
            }
            
            cardRenderer.renderCards();
        });
        
        // 防止双击选中文本
        sortOrderBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
    }
    
    // 点击页面其他地方关闭排序菜单
    document.addEventListener('click', (e) => {
        if (sortDropdownMenu && sortDropdownMenu.classList.contains('show')) {
            if (!e.target.closest('.sort-controls')) {
                toggleSortMenu(false);
            }
        }
    });
    
    // ESC键关闭排序菜单
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sortDropdownMenu && sortDropdownMenu.classList.contains('show')) {
            toggleSortMenu(false);
            sortButton?.focus();
        }
    });
    
    // 本地存储按钮
    const storageBtn = document.getElementById('storageIndicator');
    if (storageBtn) {
        console.log('初始化本地存储按钮');
        storageBtn.addEventListener('click', () => {
            console.log('点击本地存储按钮');
            uiManager.showSettingsModal();
        });
    } else {
        console.error('未找到本地存储按钮');
    }
    
    console.log('事件监听器初始化完成');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，开始初始化应用');
    
    // 检查关键元素是否存在
    const checkElements = {
        'searchInput': document.getElementById('searchInput'),
        'createTextCard': document.getElementById('createTextCard'),
        'createImageCard': document.getElementById('createImageCard'),
        'settingsBtn': document.getElementById('settingsBtn'),
        'addFolder': document.getElementById('addFolder'),
        'categoriesMenu': document.getElementById('categoriesMenu'),
        'modelTags': document.getElementById('modelTags'),
        'platformTags': document.getElementById('platformTags'),
        'cardsContainer': document.getElementById('cardsContainer')
    };
    
    let missingElements = [];
    for (const [name, element] of Object.entries(checkElements)) {
        if (!element) {
            missingElements.push(name);
            console.error(`缺少关键元素: ${name}`);
        } else {
            console.log(`✓ 找到元素: ${name}`);
        }
    }
    
    if (missingElements.length > 0) {
        console.error('发现缺失元素:', missingElements);
        alert('应用初始化失败：缺少关键UI元素！');
        return;
    }
    
    // 开始初始化
    initializeApp();
});

// 缺失的模态框函数

// 显示创建文件夹模态框
function showCreateFolderModal(parentId = null) {
    const modal = uiManager.showModal('createFolderModalTemplate');
    if (!modal) return;

    const folderNameInput = modal.querySelector('#folderName');
    const iconOptions = modal.querySelectorAll('.icon-option');
    const confirmBtn = modal.querySelector('.modal-confirm');
    
    let selectedIcon = 'fas fa-folder';
    
    // 图标选择
    iconOptions.forEach(option => {
        option.addEventListener('click', () => {
            iconOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            selectedIcon = option.dataset.icon;
        });
    });
    
    // 确认按钮
    const handleConfirm = () => {
        const folderName = folderNameInput.value.trim();
        if (!folderName) {
            uiManager.showNotification('请输入文件夹名称', 'error');
            folderNameInput.focus();
            return;
        }
        
        const folderData = {
            name: folderName,
            icon: selectedIcon,
            parent: parentId
        };
        
        appState.addFolder(folderData);
        uiManager.closeModal();
        uiManager.renderSidebar();
        uiManager.showNotification('文件夹已创建', 'success');
    };
    
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
    
    // Enter键确认
    if (folderNameInput) {
        folderNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        });
        folderNameInput.focus();
    }
}

// 显示重命名文件夹模态框
function showRenameFolderModal(folderId) {
    const folder = appState.folders.find(f => f.id === folderId);
    if (!folder) return;
    
    const modal = uiManager.showModal('renameFolderModalTemplate');
    if (!modal) return;

    const folderNameInput = modal.querySelector('#newFolderName');
    const confirmBtn = modal.querySelector('.modal-confirm');
    
    if (folderNameInput) {
        folderNameInput.value = folder.name;
        folderNameInput.select();
    }
    
    const handleConfirm = () => {
        const newName = folderNameInput.value.trim();
        if (!newName) {
            uiManager.showNotification('请输入文件夹名称', 'error');
            folderNameInput.focus();
            return;
        }
        
        appState.renameFolder(folderId, newName);
        uiManager.closeModal();
        uiManager.renderSidebar();
        uiManager.showNotification('文件夹已重命名', 'success');
    };
    
    if (confirmBtn) confirmBtn.addEventListener('click', handleConfirm);
    
    if (folderNameInput) {
        folderNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleConfirm();
            }
        });
    }
}

// 显示标签管理模态框
function showTagManagementModal(type) {
    const modal = uiManager.showModal('tagManagementModalTemplate');
    if (!modal) return;

    const title = modal.querySelector('.tag-modal-title');
    const urlGroup = modal.querySelector('.url-group');
    const existingTagsList = modal.querySelector('.existing-tags-list');
    const presetTagsList = modal.querySelector('.preset-tags-list');
    const newTagNameInput = modal.querySelector('#newTagName');
    const newTagUrlInput = modal.querySelector('#newTagUrl');
    const addTagBtn = modal.querySelector('.add-tag-btn');
    
    if (title) title.textContent = `管理${type === 'models' ? '模型' : '平台'}标签`;
    if (urlGroup) urlGroup.style.display = type === 'platforms' ? 'block' : 'none';
    
    // 渲染现有标签
    const tags = type === 'models' ? appState.getAllModelTags() : appState.getAllPlatformTags();
    const customTags = tags.filter(tag => tag.isCustom);
    
    if (existingTagsList) {
        existingTagsList.innerHTML = '';
        customTags.forEach(tag => {
            const tagEl = document.createElement('div');
            tagEl.className = 'existing-tag-item';
            tagEl.innerHTML = `
                <span>${tag.name}</span>
                <button class="tag-delete-btn" data-tag="${tag.name}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            const deleteBtn = tagEl.querySelector('.tag-delete-btn');
            deleteBtn.addEventListener('click', () => {
                appState.removeCustomTag(type, tag.name);
                showTagManagementModal(type); // 刷新模态框
                uiManager.renderTagClouds();
            });
            
            existingTagsList.appendChild(tagEl);
        });
    }
    
    // 渲染预设标签
    if (presetTagsList) {
        presetTagsList.innerHTML = '';
        const presets = type === 'models' ? appState.presetModels : appState.presetPlatforms;
        presets.forEach(preset => {
            const name = typeof preset === 'string' ? preset : preset.name;
            const tagEl = document.createElement('div');
            tagEl.className = 'preset-tag-item';
            tagEl.textContent = name;
            
            tagEl.addEventListener('click', () => {
                if (newTagNameInput) newTagNameInput.value = name;
                if (type === 'platforms' && typeof preset === 'object' && newTagUrlInput) {
                    newTagUrlInput.value = preset.url;
                }
            });
            
            presetTagsList.appendChild(tagEl);
        });
    }
    
    // 添加标签
    const handleAddTag = () => {
        const name = newTagNameInput.value.trim();
        const url = type === 'platforms' ? newTagUrlInput.value.trim() : null;
        
        if (!name) {
            uiManager.showNotification('请输入标签名称', 'error');
            return;
        }
        
        appState.addCustomTag(type, name, url);
        newTagNameInput.value = '';
        if (newTagUrlInput) newTagUrlInput.value = '';
        
        showTagManagementModal(type); // 刷新模态框
        uiManager.renderTagClouds();
        uiManager.showNotification('标签已添加', 'success');
    };
    
    if (addTagBtn) addTagBtn.addEventListener('click', handleAddTag);
    
    if (newTagNameInput) {
        newTagNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (type === 'platforms' && newTagUrlInput && !newTagUrlInput.value.trim()) {
                    newTagUrlInput.focus();
                } else {
                    handleAddTag();
                }
            }
        });
    }
    
    if (newTagUrlInput) {
        newTagUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
            }
        });
    }
}

// 显示设置模态框
function showSettingsModal() {
    const modal = uiManager.showModal('settingsModalTemplate');
    if (!modal) return;
    
    // 加载设置数据
    loadSettingsData(modal);
    
    // 添加事件监听
    addSettingsEventListeners(modal);
}

// 加载设置数据
async function loadSettingsData(modal) {
    try {
        // 获取版本信息
        const appVersion = await ipcRenderer.invoke('get-app-version');
        const electronVersion = await ipcRenderer.invoke('get-electron-version');
        const nodeVersion = await ipcRenderer.invoke('get-node-version');
        
        const appVersionEl = modal.querySelector('#appVersion');
        const electronVersionEl = modal.querySelector('#electronVersion');
        const nodeVersionEl = modal.querySelector('#nodeVersion');
        
        if (appVersionEl) appVersionEl.textContent = appVersion;
        if (electronVersionEl) electronVersionEl.textContent = electronVersion;
        if (nodeVersionEl) nodeVersionEl.textContent = nodeVersion;
        
        // 获取数据目录
        const dataDirectory = await ipcRenderer.invoke('get-data-directory');
        const dataDirectoryEl = modal.querySelector('#dataDirectory');
        
        if (dataDirectoryEl) dataDirectoryEl.textContent = dataDirectory;
        
        // 截图目录
        const screenshotDirectoryEl = modal.querySelector('#screenshotDirectory');
        if (screenshotDirectoryEl) {
            const screenshotPath = appState.settings.screenshotPath || '';
            screenshotDirectoryEl.textContent = screenshotPath || '未设置';
        }
        
        // 更新统计信息
        updateStorageStats(modal);
        
        // 加载默认分类设置
        loadDefaultCategorySetting(modal);
        
    } catch (error) {
        console.error('加载设置数据失败:', error);
    }
}

// 加载默认分类设置
function loadDefaultCategorySetting(modal) {
    const defaultCategorySelect = modal.querySelector('#defaultCategory');
    if (!defaultCategorySelect) return;
    
    // 清空现有选项
    defaultCategorySelect.innerHTML = '';
    
    // 添加所有文件夹作为选项
    appState.folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = folder.name;
        option.selected = folder.id === appState.settings.defaultCategory;
        defaultCategorySelect.appendChild(option);
    });
}

// 更新存储统计
function updateStorageStats(modal) {
    const cardCountEl = modal.querySelector('#cardCount');
    const imageCountEl = modal.querySelector('#imageCount');
    const dataSizeEl = modal.querySelector('#dataSize');
    
    if (cardCountEl) cardCountEl.textContent = appState.cards.length;
    
    const totalImages = appState.cards.reduce((count, card) => {
        return count + (card.images ? card.images.length : 0);
    }, 0);
    
    if (imageCountEl) imageCountEl.textContent = totalImages;
    if (dataSizeEl) dataSizeEl.textContent = '< 1 MB'; // 简化处理
}

// 添加设置事件监听
function addSettingsEventListeners(modal) {
    // 选择图片存储路径

    

    

    

    
    // 选择截图保存目录
    const selectScreenshotDirectoryBtn = modal.querySelector('#selectScreenshotDirectory');
    const screenshotDirectoryEl = modal.querySelector('#screenshotDirectory');
    
    if (selectScreenshotDirectoryBtn) {
        selectScreenshotDirectoryBtn.addEventListener('click', async () => {
            try {
                const selectedPath = await ipcRenderer.invoke('select-directory');
                if (selectedPath) {
                    appState.settings.screenshotPath = selectedPath;
                    if (screenshotDirectoryEl) {
                        screenshotDirectoryEl.textContent = selectedPath;
                    }
                    appState.saveData();
                    uiManager.showNotification('截图保存目录已设置', 'success');
                }
            } catch (error) {
                console.error('选择文件夹失败:', error);
                uiManager.showNotification('选择文件夹失败', 'error');
            }
        });
    }
    
    // 打开截图保存目录
    const openScreenshotDirectoryBtn = modal.querySelector('#openScreenshotDirectory');
    if (openScreenshotDirectoryBtn) {
        openScreenshotDirectoryBtn.addEventListener('click', async () => {
            try {
                const screenshotPath = appState.settings.screenshotPath;
                if (screenshotPath) {
                    await ipcRenderer.invoke('show-item-in-folder', screenshotPath);
                } else {
                    uiManager.showNotification('请先设置截图保存目录', 'error');
                }
            } catch (error) {
                console.error('打开目录失败:', error);
                uiManager.showNotification('打开目录失败', 'error');
            }
        });
    }
    
    // 打开数据目录
    const openDataDirectoryBtn = modal.querySelector('#openDataDirectory');
    if (openDataDirectoryBtn) {
        openDataDirectoryBtn.addEventListener('click', async () => {
            try {
                const dataDirectory = await ipcRenderer.invoke('get-data-directory');
                await ipcRenderer.invoke('show-item-in-folder', dataDirectory);
            } catch (error) {
                console.error('打开数据目录失败:', error);
                uiManager.showNotification('打开数据目录失败', 'error');
            }
        });
    }
    

    
    // 默认分类设置变更
    const defaultCategorySelect = modal.querySelector('#defaultCategory');
    if (defaultCategorySelect) {
        defaultCategorySelect.addEventListener('change', (e) => {
            appState.settings.defaultCategory = e.target.value;
            appState.saveData();
            uiManager.showNotification('默认分类已更新', 'success');
        });
    }
    
    // 刷新统计按钮
    const refreshStatsBtn = modal.querySelector('#refreshStats');
    if (refreshStatsBtn) {
        refreshStatsBtn.addEventListener('click', () => {
            updateStorageStats(modal);
            uiManager.showNotification('统计信息已刷新', 'success');
        });
    }
    
    // 导入数据
    const importDataBtn = modal.querySelector('#importData');
    if (importDataBtn) {
        importDataBtn.addEventListener('click', async () => {
            try {
                const filePaths = await ipcRenderer.invoke('select-files', {
                    filters: [{ name: 'JSON文件', extensions: ['json'] }]
                });
                
                if (filePaths.length > 0) {
                    const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
                    appState.cards = data.cards || [];
                    appState.folders = data.folders || [];
                    appState.customTags = data.customTags || { models: [], platforms: [] };
                    appState.settings = { ...appState.settings, ...data.settings };
                    
                    await appState.saveData();
                    
                    // 重新渲染界面
                    uiManager.renderSidebar();
                    uiManager.renderTagClouds();
                    cardRenderer.renderCards();
                    updateStorageStats(modal);
                    
                    uiManager.showNotification('数据导入成功', 'success');
                }
            } catch (error) {
                console.error('导入数据失败:', error);
                uiManager.showNotification('导入数据失败', 'error');
            }
        });
    }
    
    // 导出数据
    const exportDataBtn = modal.querySelector('#exportData');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', async () => {
            try {
                const filePath = await ipcRenderer.invoke('show-save-dialog', {
                    defaultPath: `promptcard-backup-${new Date().toISOString().slice(0, 10)}.json`,
                    filters: [{ name: 'JSON文件', extensions: ['json'] }]
                });
                
                if (filePath) {
                    const data = {
                        cards: appState.cards,
                        folders: appState.folders,
                        customTags: appState.customTags,
                        settings: appState.settings,
                        version: '1.0.0',
                        exportedAt: new Date().toISOString()
                    };
                    
                    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
                    uiManager.showNotification('数据导出成功', 'success');
                }
            } catch (error) {
                console.error('导出数据失败:', error);
                uiManager.showNotification('导出数据失败', 'error');
            }
        });
    }
    
    // 清空所有数据
    const clearAllDataBtn = modal.querySelector('#clearAllData');
    if (clearAllDataBtn) {
        clearAllDataBtn.addEventListener('click', async () => {
            const confirmed = await uiManager.confirm('确定要清空所有数据吗？这将删除所有卡片和文件夹，无法恢复！');
            if (confirmed) {
                appState.cards = [];
                appState.folders = [];
                appState.customTags = { models: [], platforms: [] };
                await appState.saveData();
                uiManager.renderSidebar();
                uiManager.renderTagClouds();
                cardRenderer.renderCards();
                uiManager.showNotification('所有数据已清空', 'success');
            }
        });
    }
    

}

// 初始化全局拖拽事件处理
function initializeGlobalDragHandling() {
    // 阻止页面默认的拖拽行为
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        console.log('全局drop事件被阻止');
    });
    
    // 为所有图片上传区域添加特殊标记
    document.addEventListener('dragenter', (e) => {
        const uploadArea = e.target.closest('.image-upload-area');
        if (uploadArea) {
            e.stopPropagation();
            console.log('拖拽进入图片上传区域');
        }
    });
    
    console.log('全局拖拽事件处理器已添加');
}