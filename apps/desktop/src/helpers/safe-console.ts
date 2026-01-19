/**
 * Safe console utilities that prevent EIO errors
 * Use these instead of console.log/error/warn in the main process
 */

const safeConsole = {
  log: (...args: any[]) => {
    try {
      if (process.stdout?.writable ?? true) {
        console.log(...args);
      }
    } catch {
      // Ignore EIO or broken pipe errors
    }
  },
  warn: (...args: any[]) => {
    try {
      if (process.stderr?.writable ?? true) {
        console.warn(...args);
      }
    } catch {
      // Ignore EIO or broken pipe errors
    }
  },
  error: (...args: any[]) => {
    try {
      if (process.stderr?.writable ?? true) {
        console.error(...args);
      }
    } catch {
      // Ignore EIO or broken pipe errors
    }
  },
};

export default safeConsole;
