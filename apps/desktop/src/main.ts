import { app, BrowserWindow } from "electron";
import registerListeners from "./helpers/ipc/listeners-register";
// "electron-squirrel-startup" seems broken when packaging with vite
//import started from "electron-squirrel-startup";
import path from "path";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";

const inDevelopment = process.env.NODE_ENV === "development";

// Store reference to main window for deep link handling
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const preload = path.join(__dirname, "preload.js");
  
  const iconPath = inDevelopment
    ? path.join(process.cwd(), "images", "icon.png")
    : path.join(process.resourcesPath, "images", "icon.png");
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: iconPath,
    webPreferences: {
      devTools: inDevelopment,
      contextIsolation: true,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,

      preload: preload,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition:
      process.platform === "darwin" ? { x: 20, y: 13 } : undefined,
  });
  registerListeners(mainWindow);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
  
  return mainWindow;
}

function handleDeepLink(url: string) {
  console.log("Deep link received:", url);
  
  // Parse deep link: cortex://callback?success=true&sessionToken=xxx&accountIds=xxx,yyy&customerId=xxx
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== "cortex:") {
      return;
    }
    
    const params = new URLSearchParams(urlObj.search);
    const success = params.get("success") === "true";
    const sessionToken = params.get("sessionToken");
    const accountIds = params.get("accountIds")?.split(",") || [];
    const customerId = params.get("customerId");
    const error = params.get("error");
    
    // Send IPC message to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("deep-link-callback", {
        success,
        sessionToken,
        accountIds,
        customerId,
        error,
      });
      
      // Focus window
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  } catch (error) {
    console.error("Error parsing deep link:", error);
  }
}

async function installExtensions() {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch {
    console.error("Failed to install extensions");
  }
}

// Register deep link protocol
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // Register protocol handler
  if (process.defaultApp) {
    if (process.platform === "win32") {
      app.setAsDefaultProtocolClient("cortex", process.execPath, [path.resolve(process.argv[1])]);
    } else {
      app.setAsDefaultProtocolClient("cortex");
    }
  } else {
    app.setAsDefaultProtocolClient("cortex");
  }

  // Handle deep link on macOS (when app is already running)
  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });

  // Handle deep link on Windows/Linux (when app is already running)
  app.on("second-instance", (event, commandLine) => {
    // Focus window
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
    
    // Parse command line for deep link
    const url = commandLine.find((arg) => arg.startsWith("cortex://"));
    if (url) {
      handleDeepLink(url);
    }
  });

  // Handle deep link on Windows/Linux (when app is not running)
  const url = process.argv.find((arg) => arg.startsWith("cortex://"));
  if (url) {
    handleDeepLink(url);
  }

  app.whenReady().then(() => {
    if (process.platform === "darwin") {
      const iconPath = inDevelopment
        ? path.join(process.cwd(), "images", "icon.png")
        : path.join(process.resourcesPath, "images", "icon.png");
      
      try {
        if (app.dock) {
          app.dock.setIcon(iconPath);
        }
      } catch (error) {
        console.error("Failed to set dock icon:", error);
      }
    }
    createWindow();
    installExtensions();
  });
}

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
//osX only ends
