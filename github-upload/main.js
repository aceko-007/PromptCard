const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 保持对窗口对象的全局引用，如果你不这样做，当JavaScript对象被垃圾回收，窗口会被自动地关闭
let mainWindow;

// 获取数据存储目录
function getDataDirectory() {
  const appPath = path.dirname(app.getPath('exe'));
  const dataDir = path.join(appPath, 'data');
  
  // 确保目录存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  return dataDir;
}

// 将图片转换为Base64编码
function imageToBase64(filePath) {
  const bitmap = fs.readFileSync(filePath);
  return Buffer.from(bitmap).toString('base64');
}

// 移除图片查看器相关IPC通信
ipcMain.removeHandler('open-image-viewer');

// 添加图片下载功能
ipcMain.handle('download-image', async (event, { base64Data, fileName }) => {
  const { dialog } = require('electron');
  const fs = require('fs');
  const path = require('path');
  
  // 让用户选择下载目录
  const result = await dialog.showSaveDialog({
    title: '保存图片',
    defaultPath: path.join(app.getPath('downloads'), fileName),
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] }
    ]
  });
  
  if (!result.canceled && result.filePath) {
    try {
      // 将Base64数据转换为Buffer
      const buffer = Buffer.from(base64Data, 'base64');
      // 写入文件
      fs.writeFileSync(result.filePath, buffer);
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: '用户取消操作' };
});

// 添加卡片截图功能
ipcMain.handle('capture-card-screenshot', async (event, { cardId }) => {
  try {
    // 获取当前窗口
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return { success: false, error: '无法获取窗口' };
    }
    
    // 通知渲染进程准备截图
    event.sender.send('prepare-card-for-screenshot', cardId);
    
    // 等待渲染进程准备好
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 获取卡片元素的位置和大小信息
    const cardRect = await event.sender.executeJavaScript(`
      (function() {
        const card = document.querySelector('.card[data-card-id="${cardId}"]');
        if (!card) return null;
        const rect = card.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      })();
    `);
    
    if (!cardRect) {
      return { success: false, error: '找不到卡片元素' };
    }
    
    // 捕获指定区域的截图
    const image = await win.webContents.capturePage({
      x: cardRect.x,
      y: cardRect.y,
      width: cardRect.width,
      height: cardRect.height
    });
    const pngData = image.toPNG();
    
    // 返回截图数据
    return { 
      success: true, 
      data: pngData.toString('base64'),
      width: image.getSize().width,
      height: image.getSize().height
    };
  } catch (error) {
    console.error('截图失败:', error);
    return { success: false, error: error.message };
  }
});

// 添加保存截图功能
ipcMain.handle('save-screenshot', async (event, { base64Data, filePath }) => {
  try {
    // 将Base64数据转换为Buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 确保目录存在
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    // 写入文件
    fs.writeFileSync(filePath, buffer);
    
    return { success: true, path: filePath };
  } catch (error) {
    console.error('保存截图失败:', error);
    return { success: false, error: error.message };
  }
});

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false, // 先不显示，等待ready-to-show事件
    titleBarStyle: 'default'
  });

  // 加载应用的index.html
  mainWindow.loadFile('renderer/index.html');

  // 当窗口准备好显示时
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 使用全局快捷键
  const { globalShortcut } = require('electron');
  
  app.whenReady().then(() => {
    // 注册F5刷新
    globalShortcut.register('F5', () => {
      if (mainWindow) {
        mainWindow.reload();
      }
    });

    // 注册Ctrl+F5强制刷新
    globalShortcut.register('CommandOrControl+F5', () => {
      if (mainWindow) {
        mainWindow.webContents.reloadIgnoringCache();
      }
    });
  });

  // 应用退出时注销快捷键
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  // 当window被关闭，这个事件会被触发
  mainWindow.on('closed', () => {
    // 取消引用window对象，如果你的应用支持多窗口的话，通常会把多个window对象存放在一个数组里面，与此同时，你应该删除相应的元素。
    mainWindow = null;
  });

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Electron会在初始化后并准备创建浏览器窗口时，调用这个函数。
// 部分API在ready事件触发后才能使用。
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // 在macOS上，当单击dock图标并且没有其他窗口打开时，通常在应用程序中重新创建一个窗口。
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 当全部窗口关闭时退出。
app.on('window-all-closed', () => {
  // 在macOS上，除非用户用Cmd + Q确定地退出，否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 在这个文件中，你可以续写应用剩下主进程代码。也可以拆分成几个文件，然后用require导入。

// IPC处理程序
ipcMain.handle('get-data-directory', () => {
  return getDataDirectory();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-electron-version', () => {
  return process.versions.electron;
});

ipcMain.handle('get-node-version', () => {
  return process.versions.node;
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  
  return null;
});

ipcMain.handle('select-files', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: options.filters || []
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths;
  }
  
  return [];
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  
  if (!result.canceled) {
    return result.filePath;
  }
  
  return null;
});

ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('show-item-in-folder', async (event, path) => {
  shell.showItemInFolder(path);
});

// 设置应用菜单
function setApplicationMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建文本卡片',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('create-text-card');
          }
        },
        {
          label: '新建图片卡片',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            mainWindow.webContents.send('create-image-card');
          }
        },
        { type: 'separator' },
        {
          label: '设置',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('open-settings');
          }
        },
        { type: 'separator' },
        {
          role: 'quit',
          label: '退出'
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectall', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '切换开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'close', label: '关闭' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 PromptCard Desktop',
          click: () => {
            mainWindow.webContents.send('show-about');
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    // Window menu
    template[4].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  setApplicationMenu();
});