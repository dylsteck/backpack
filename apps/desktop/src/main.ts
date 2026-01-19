import { app, BrowserWindow, ipcMain } from "electron";
import { spawn, ChildProcess } from "child_process";
import * as net from "net";
import * as fs from "fs";
import registerListeners from "./helpers/ipc/listeners-register";
import { getDatabasePath, getDefaultDatabasePath, setServerPort } from "./helpers/ipc/database/database-listeners";
import { getMCPInstance } from "./helpers/mcp/chrome-devtools";
import { setMCPClient } from "./helpers/ipc/browser/browser-listeners";
import { startBrowserBridge, stopBrowserBridge, getBridgePort } from "./helpers/browser/http-bridge";
// "electron-squirrel-startup" seems broken when packaging with vite
//import started from "electron-squirrel-startup";
import path from "path";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
import safeConsole from "./helpers/safe-console";

const inDevelopment = process.env.NODE_ENV === "development";

// Store reference to main window for deep link handling
let mainWindow: BrowserWindow | null = null;

// Server process management
let serverProcess: ChildProcess | null = null;
let serverPort: number = 3000;
let remoteDebugPort: number = 9222;

/**
 * Find an available port starting from the given port
 */
async function findAvailablePort(startPort: number = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(startPort, "127.0.0.1", () => {
      const address = server.address() as net.AddressInfo;
      const port = address.port;
      server.close(() => resolve(port));
    });
    
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        // Port in use, try next one
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Ensure remote debugging port is available (avoid conflicts with other browsers)
 */
async function setupRemoteDebuggingPort(): Promise<number> {
  try {
    const port = await findAvailablePort(9222);
    remoteDebugPort = port;
    // CRITICAL: Enable remote debugging BEFORE app is ready for CDP access
    app.commandLine.appendSwitch("remote-debugging-port", String(port));
    // Pass port to MCP server + bridge
    process.env.ELECTRON_CDP_PORT = String(port);
    safeConsole.log(`[MCP] Using Electron CDP port ${port}`);
    return port;
  } catch (error) {
    console.error("[MCP] Failed to find available CDP port, falling back to 9222", error);
    remoteDebugPort = 9222;
    app.commandLine.appendSwitch("remote-debugging-port", "9222");
    process.env.ELECTRON_CDP_PORT = "9222";
    return 9222;
  }
}

/**
 * Wait for server to be ready
 */
async function waitForServer(port: number, maxAttempts: number = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

/**
 * Start the API server
 */
async function startServer(): Promise<number> {
  const port = await findAvailablePort(3000);
  
  // Determine server path based on packaged state
  let serverPath: string;
  let args: string[] = [];
  let command: string;
  
  if (app.isPackaged) {
    // Production: use compiled binary
    const binaryName = process.platform === "win32" ? "server.exe" : "server";
    serverPath = path.join(process.resourcesPath, binaryName);
    command = serverPath;
  } else {
    // Development: run with bun
    // Resolve server path - try multiple strategies
    const possiblePaths = [
      // From workspace root (typical case)
      path.resolve(process.cwd(), "apps", "server", "src", "index.ts"),
      // From apps/desktop (if cwd is there)
      path.resolve(process.cwd(), "..", "server", "src", "index.ts"),
      // From __dirname (if running from dist)
      path.resolve(__dirname, "..", "..", "..", "server", "src", "index.ts"),
    ];
    
    // Find the first path that exists
    serverPath = possiblePaths.find(p => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) || possiblePaths[0]; // Fallback to first path
    
    command = "bun";
    args = ["run", serverPath];
  }
  
  safeConsole.log(`Starting server on port ${port}...`);
  safeConsole.log(`Server path: ${serverPath}`);
  
  return new Promise((resolve, reject) => {
    // Get the database path (either user-configured or default)
    const dbPath = getDatabasePath() || getDefaultDatabasePath();
    
    const env = {
      ...process.env,
      PORT: port.toString(),
      NODE_ENV: inDevelopment ? "development" : "production",
      DATABASE_PATH: dbPath,
    };
    
    if (app.isPackaged) {
      serverProcess = spawn(command, [], { 
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } else {
      serverProcess = spawn(command, args, { 
        env,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });
    }
    
    if (serverProcess.stdout) {
      serverProcess.stdout.on("data", (data) => {
        console.log(`[Server] ${data.toString().trim()}`);
      });
    }
    
    if (serverProcess.stderr) {
      serverProcess.stderr.on("data", (data) => {
        safeConsole.error(`[Server Error] ${data.toString().trim()}`);
      });
    }
    
    serverProcess.on("error", (error) => {
      console.error("Failed to start server:", error);
      reject(error);
    });
    
    serverProcess.on("exit", (code) => {
      safeConsole.log(`Server process exited with code ${code}`);
      serverProcess = null;
    });
    
    // Wait for server to be ready
    waitForServer(port)
      .then((ready) => {
        if (ready) {
          console.log(`Server ready on port ${port}`);
          resolve(port);
        } else {
          reject(new Error("Server failed to start in time"));
        }
      })
      .catch(reject);
  });
}

/**
 * Stop the server process
 */
function stopServer(): void {
  if (serverProcess) {
    safeConsole.log("Stopping server...");
    
    // Try graceful shutdown first
    serverProcess.kill("SIGTERM");
    
    // Force kill after 5 seconds if still running
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        console.log("Force killing server...");
        serverProcess.kill("SIGKILL");
      }
    }, 5000);
    
    serverProcess = null;
  }
}

// IPC handler to get server port
ipcMain.handle("get-server-port", () => {
  return serverPort;
});

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
  safeConsole.log("Deep link received:", url);
  
  // Parse deep link: cortex://callback?success=true&sessionToken=xxx&accountIds=xxx,yyy&customerId=xxx
  // For Teller: cortex://callback?success=true&sessionToken=xxx&accessToken=xxx&enrollmentId=xxx&institutionName=xxx
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
    // Teller-specific fields
    const accessToken = params.get("accessToken");
    const enrollmentId = params.get("enrollmentId");
    const institutionName = params.get("institutionName");
    const error = params.get("error");
    
    // Send IPC message to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("deep-link-callback", {
        success,
        sessionToken,
        accountIds,
        customerId,
        // Teller-specific fields
        accessToken,
        enrollmentId,
        institutionName,
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
    safeConsole.log(`Extensions installed successfully: ${result.name}`);
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

  const startApp = async (): Promise<void> => {
    // Ensure we use a free CDP port so Electron doesn't attach to an existing browser
    await setupRemoteDebuggingPort();
    await app.whenReady();

    if (process.platform === "darwin") {
      const iconPath = inDevelopment
        ? path.join(process.cwd(), "images", "icon.png")
        : path.join(process.resourcesPath, "images", "icon.png");
      
      try {
        if (app.dock) {
          app.dock.setIcon(iconPath);
        }
      } catch (error) {
        safeConsole.error("Failed to set dock icon:", error);
      }
    }
    
    // Start server before creating window
    try {
      serverPort = await startServer();
      // Let database listeners know the server port for API calls
      setServerPort(serverPort);
      console.log(`API server running on http://127.0.0.1:${serverPort}`);
    } catch (error) {
      safeConsole.error("Failed to start API server:", error);
      // Continue anyway - might be running separately in development
    }
    
    // Start MCP server for browser control
    // Note: MCP server needs at least one browser tab to connect to CDP
    // So we start it but it won't work until a tab is created
    try {
      const mcpInstance = getMCPInstance();
      // Start MCP server (it will initialize when browser tabs are available)
      mcpInstance.start().catch((error) => {
        console.error('[MCP] Failed to start MCP server:', error);
        console.log('[MCP] Browser will work, but MCP tools may not be available');
      });
      setMCPClient(mcpInstance);
      safeConsole.log('[MCP] Chrome DevTools MCP server starting...');
      
      // Start HTTP bridge for server to call browser tools
      const bridgePort = await startBrowserBridge();
      // Set environment variable so server knows the bridge port
      process.env.BROWSER_BRIDGE_PORT = bridgePort.toString();
    } catch (error) {
      console.error('[MCP] Failed to start MCP components:', error);
      // Continue anyway - browser will work without MCP
    }
    
    createWindow();
    
    // Send server port to renderer once loaded
    if (mainWindow) {
      mainWindow.webContents.on("did-finish-load", () => {
        mainWindow?.webContents.send("server-port", serverPort);
      });
    }
    
    installExtensions();
  };

  startApp().catch((error) => {
    safeConsole.error("Failed to start app:", error);
  });
}

// Clean up server on quit
app.on("before-quit", async () => {
  stopServer();
  stopBrowserBridge();
  const mcpInstance = getMCPInstance();
  await mcpInstance.stop();
});

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
