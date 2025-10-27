import { app, BrowserWindow, Menu, shell, Tray, nativeImage } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { WindowStateManager } from './window-state';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch (e) {
  // electron-squirrel-startup might not be available
}

let mainWindow: BrowserWindow | null = null;
let viteProcess: ChildProcess | null = null;
let tray: Tray | null = null;
const isDev = process.env.NODE_ENV !== 'production';
const vitePort = 3002;
const windowStateManager = new WindowStateManager('main');

const createWindow = (): void => {
  // Create the browser window with default dimensions
  const defaultState = { width: 1200, height: 800 };
  
  mainWindow = new BrowserWindow({
    ...defaultState,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    titleBarStyle: 'default',
    show: false,
  });

  // Manage window state (this will restore saved position/size)
  windowStateManager.manage(mainWindow);

  // Load the Vite app
  const viteURL = `http://localhost:${vitePort}`;
  
  // In dev mode, Vite is already running via concurrently
  // In prod mode, we wait for preview server
  setTimeout(() => {
    if (mainWindow) {
      mainWindow.loadURL(viteURL).catch((err) => {
        console.error('Failed to load Vite app:', err);
      });
    }
  }, isDev ? 500 : 1000);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (isDev) {
      mainWindow?.webContents.openDevTools();
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();

  // Create tray icon
  createTray();
};

const createTray = () => {
  // Skip tray on macOS as it's not common practice there
  if (process.platform === 'darwin') return;

  try {
    // Create a simple tray icon (you'll want to replace this with an actual icon file)
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        },
      },
    ]);

    tray.setToolTip('Cortex Desktop');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
  } catch (error) {
    console.error('Error creating tray:', error);
  }
};

const createMenu = () => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

const startViteServer = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const command = isDev ? 'bun' : 'bun';
    const args = isDev ? ['run', 'dev:vite'] : ['run', 'preview'];
    
    viteProcess = spawn(command, args, {
      cwd: app.getAppPath(),
      env: { 
        ...process.env,
        VITE_SERVER_URL: process.env.VITE_SERVER_URL || 'http://localhost:3000',
      },
      shell: true,
    });

    viteProcess.stdout?.on('data', (data) => {
      console.log(`Vite: ${data}`);
      if (data.toString().includes('ready') || data.toString().includes('Local:') || data.toString().includes('3002')) {
        resolve();
      }
    });

    viteProcess.stderr?.on('data', (data) => {
      console.error(`Vite Error: ${data}`);
    });

    viteProcess.on('error', (error) => {
      console.error('Failed to start Vite:', error);
      reject(error);
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      resolve(); // Resolve anyway to allow window creation
    }, 15000);
  });
};

const stopViteServer = () => {
  if (viteProcess) {
    viteProcess.kill();
    viteProcess = null;
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', async () => {
  try {
    // In development, Vite is started by concurrently, so just connect to it
    // In production, we need to start the preview server
    if (!isDev) {
      console.log('Starting Vite server...');
      await startViteServer();
      console.log('Vite server started');
    } else {
      console.log('Connecting to Vite dev server...');
      // Wait a moment for Vite to be ready (started by concurrently)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    createWindow();
  } catch (error) {
    console.error('Error:', error);
    // Create window anyway if in development
    if (isDev) {
      createWindow();
    } else {
      app.quit();
    }
  }
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  stopViteServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopViteServer();
});

app.on('will-quit', () => {
  stopViteServer();
});
