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
let nextProcess: ChildProcess | null = null;
let tray: Tray | null = null;
const isDev = process.env.NODE_ENV !== 'production';
const nextPort = 3002;
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

  // Load the Next.js app (not the webpack renderer)
  const nextURL = `http://localhost:${nextPort}`;
  
  // Wait a bit for Next.js to be ready before loading
  setTimeout(() => {
    if (mainWindow) {
      mainWindow.loadURL(nextURL).catch((err) => {
        console.error('Failed to load Next.js app:', err);
      });
    }
  }, isDev ? 3000 : 1000);

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

const startNextServer = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const command = isDev ? 'npm' : 'npm';
    const args = isDev ? ['run', 'dev:next'] : ['run', 'start:next'];
    
    nextProcess = spawn(command, args, {
      cwd: app.getAppPath(),
      env: { 
        ...process.env, 
        PORT: nextPort.toString(),
        NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000',
      },
      shell: true,
    });

    nextProcess.stdout?.on('data', (data) => {
      console.log(`Next.js: ${data}`);
      if (data.toString().includes('Ready') || data.toString().includes('started server')) {
        resolve();
      }
    });

    nextProcess.stderr?.on('data', (data) => {
      console.error(`Next.js Error: ${data}`);
    });

    nextProcess.on('error', (error) => {
      console.error('Failed to start Next.js:', error);
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      resolve(); // Resolve anyway to allow window creation
    }, 30000);
  });
};

const stopNextServer = () => {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', async () => {
  try {
    console.log('Starting Next.js server...');
    await startNextServer();
    console.log('Next.js server started');
    createWindow();
  } catch (error) {
    console.error('Error starting Next.js:', error);
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
  stopNextServer();
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
  stopNextServer();
});

app.on('will-quit', () => {
  stopNextServer();
});
