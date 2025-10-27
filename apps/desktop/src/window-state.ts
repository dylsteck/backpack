import { app, screen, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
  isFullScreen?: boolean;
}

const defaultState: WindowState = {
  width: 1200,
  height: 800,
};

export class WindowStateManager {
  private state: WindowState;
  private winRef: BrowserWindow | null = null;
  private stateStoreFile: string;

  constructor(windowName: string) {
    const userDataPath = app.getPath('userData');
    this.stateStoreFile = path.join(userDataPath, `window-state-${windowName}.json`);
    this.state = this.loadState();
  }

  private loadState(): WindowState {
    try {
      if (fs.existsSync(this.stateStoreFile)) {
        const data = fs.readFileSync(this.stateStoreFile, 'utf-8');
        return { ...defaultState, ...JSON.parse(data) };
      }
    } catch (err) {
      console.error('Error loading window state:', err);
    }
    return defaultState;
  }

  private saveState() {
    if (!this.winRef) return;

    try {
      const bounds = this.winRef.getBounds();
      this.state = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        isMaximized: this.winRef.isMaximized(),
        isFullScreen: this.winRef.isFullScreen(),
      };

      fs.writeFileSync(this.stateStoreFile, JSON.stringify(this.state));
    } catch (err) {
      console.error('Error saving window state:', err);
    }
  }

  manage(win: BrowserWindow) {
    this.winRef = win;

    // Validate the window position
    this.validateState();

    // Restore maximized/fullscreen state
    if (this.state.isMaximized) {
      win.maximize();
    }
    if (this.state.isFullScreen) {
      win.setFullScreen(true);
    }

    // Save state on window events
    const saveStateHandler = () => this.saveState();
    
    win.on('resize', saveStateHandler);
    win.on('move', saveStateHandler);
    win.on('close', saveStateHandler);

    return this.state;
  }

  private validateState() {
    const visible = screen.getAllDisplays().some((display) => {
      const area = display.workArea;
      return (
        this.state.x !== undefined &&
        this.state.y !== undefined &&
        this.state.x >= area.x &&
        this.state.y >= area.y &&
        this.state.x + this.state.width <= area.x + area.width &&
        this.state.y + this.state.height <= area.y + area.height
      );
    });

    if (!visible) {
      // Reset to center if window is not visible
      delete this.state.x;
      delete this.state.y;
    }
  }
}

