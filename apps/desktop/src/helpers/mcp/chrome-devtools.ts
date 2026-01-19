import { spawn, ChildProcess } from "child_process";

interface MCPRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

import safeConsole from '../safe-console';

export class ChromeDevToolsMCP {
  private process: ChildProcess | null = null;
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
  private requestIdCounter = 0;
  private isRunning = false;
  private tools: MCPTool[] = [];
  
  /**
   * Start the MCP server process
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      safeConsole.log('[MCP] Server already running');
      return;
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Try to find available package manager
        // Prefer npx (comes with npm) as it's more widely available
        const command = 'npx';
        const cdpPort = process.env.ELECTRON_CDP_PORT || process.env.CDP_PORT || '9222';
        const args = ['-y', 'chrome-devtools-mcp@latest', `--browser-url=http://127.0.0.1:${cdpPort}`];
        
        safeConsole.log(`[MCP] Spawning chrome-devtools-mcp with: ${command} ${args.join(' ')} (CDP port ${cdpPort})`);
        
        this.process = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
          env: process.env,
        });
        
        let stderrBuffer = '';
        
        // Handle stdout (MCP protocol messages)
        this.process.stdout?.on('data', (data: Buffer) => {
          const text = data.toString();
          // Process messages without excessive logging to prevent I/O overflow
          this.processMessages(text);
        });
        
        // Log when stdout ends (process might have crashed)
        this.process.stdout?.on('end', () => {
          safeConsole.warn('[MCP] stdout ended - process might have crashed or exited');
          // Reject all pending requests
          for (const [id, pending] of this.pendingRequests.entries()) {
            pending.reject(new Error('MCP process stdout ended'));
          }
          this.pendingRequests.clear();
        });
        
        this.process.stdout?.on('error', (error) => {
          safeConsole.error('[MCP] stdout error:', error);
          // Reject all pending requests
          for (const [id, pending] of this.pendingRequests.entries()) {
            pending.reject(new Error(`MCP stdout error: ${error.message}`));
          }
          this.pendingRequests.clear();
        });
        
        // Handle stderr (debug logs) - IMPORTANT for debugging CDP connection issues
        this.process.stderr?.on('data', (data: Buffer) => {
          stderrBuffer += data.toString();
          const lines = stderrBuffer.split('\n');
          stderrBuffer = lines.pop() || ''; // Keep incomplete line
          lines.forEach(line => {
            if (line.trim()) {
              // Log all stderr - chrome-devtools-mcp outputs important info here
              safeConsole.log('[MCP stderr]', line);
              // Check for CDP connection errors
              if (line.includes('ECONNREFUSED') || line.includes('connect') || line.includes('CDP') || line.includes('page')) {
                safeConsole.warn('[MCP] CDP connection issue detected:', line);
              }
            }
          });
        });
        
        // Check if stdin is writable
        if (!this.process.stdin || this.process.stdin.destroyed) {
          safeConsole.error('[MCP] Stdin is not available or destroyed');
        } else {
          safeConsole.log('[MCP] Stdin is ready');
        }
        
        this.process.on('error', (error) => {
          safeConsole.error('[MCP] Process spawn error:', error);
          safeConsole.error('[MCP] This might be due to missing bun/npx. Browser will work without MCP tools.');
          this.isRunning = false;
          // Don't reject - allow browser to work without MCP
          resolve();
        });
        
        this.process.on('exit', (code, signal) => {
          safeConsole.log(`[MCP] Process exited with code ${code}, signal ${signal}`);
          this.isRunning = false;
          this.process = null;
          // Clear all pending requests
          for (const [id, pending] of this.pendingRequests.entries()) {
            pending.reject(new Error('MCP process exited'));
          }
          this.pendingRequests.clear();
        });
        
        // Wait a bit for server to initialize, then initialize
        setTimeout(async () => {
          try {
            await this.initialize();
            this.isRunning = true;
            safeConsole.log('[MCP] Server initialized successfully');
            resolve();
          } catch (error) {
            safeConsole.error('[MCP] Initialization failed:', error);
            // Don't reject - allow browser to work without MCP
            this.isRunning = false;
            resolve(); // Resolve anyway so browser can work
          }
        }, 3000); // Increased wait time
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Initialize MCP connection - list available tools
   */
  private async initialize(): Promise<void> {
    try {
      // Wait a bit for MCP server to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Check if process is still running
      if (!this.process || this.process.killed) {
        safeConsole.warn('[MCP] Process died before initialization');
        return;
      }
      
      // First, send initialize request (MCP protocol requirement)
      try {
        const initResponse = await this.sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'cortex-desktop',
            version: '1.0.0',
          },
        });
        safeConsole.log('[MCP] Initialize response:', JSON.stringify(initResponse).substring(0, 200));
        
        // Send initialized notification (no response expected, no ID)
        try {
          const notifyRequest = {
            jsonrpc: '2.0',
            method: 'notifications/initialized',
            params: {},
            // No 'id' field - this is a notification, not a request
          };
          const notifyLine = JSON.stringify(notifyRequest) + '\n';
          if (this.process?.stdin && !this.process.stdin.destroyed) {
            const written = this.process.stdin.write(notifyLine);
            if (written) {
              safeConsole.log('[MCP] Sent initialized notification');
            } else {
              safeConsole.warn('[MCP] Failed to write initialized notification (buffer full)');
            }
          }
        } catch (error) {
          safeConsole.warn('[MCP] Failed to send initialized notification:', error);
        }
      } catch (error) {
        safeConsole.warn('[MCP] Initialize failed, trying without it:', error);
        // Continue anyway - some MCP servers don't require initialize
      }
      
      // Wait a bit more before listing tools
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // List available tools using MCP protocol
      const toolsResponse = await this.sendRequest('tools/list', {});
      if (toolsResponse && toolsResponse.tools) {
        this.tools = toolsResponse.tools;
        safeConsole.log(`[MCP] Initialized with ${this.tools.length} tools:`, this.tools.map(t => t.name).slice(0, 10));
        this.isRunning = true;
      } else {
        safeConsole.warn('[MCP] No tools returned from server, response:', toolsResponse);
        // Still mark as running if we got a response (even if empty)
        if (toolsResponse !== undefined) {
          this.isRunning = true;
        }
      }
    } catch (error) {
      safeConsole.error('[MCP] Initialization error:', error);
      // Don't throw - allow browser to work without MCP tools
      safeConsole.log('[MCP] Continuing without tool initialization');
      // Don't set isRunning = true if initialization failed
    }
  }
  
  /**
   * Retry initialization (called when browser tabs become available)
   */
  async retryInitialization(): Promise<void> {
    if (this.isRunning) {
    safeConsole.log('[MCP] Already initialized, skipping retry');
      return;
    }
    
    if (!this.process || this.process.killed) {
    safeConsole.warn('[MCP] Cannot retry - process not running');
      return;
    }
    
    safeConsole.log('[MCP] Retrying initialization now that browser tabs are available');
    try {
      await this.initialize();
      if (this.isRunning) {
        safeConsole.log('[MCP] Retry initialization successful');
      }
    } catch (error) {
      safeConsole.error('[MCP] Retry initialization failed:', error);
    }
  }
  
  /**
   * Process incoming messages from MCP server
   */
  private stdoutBuffer = '';
  
  private processMessages(data: string): void {
    // Accumulate data in buffer
    this.stdoutBuffer += data;
    
    // MCP uses JSON-RPC over newline-delimited JSON
    const lines = this.stdoutBuffer.split('\n');
    // Keep incomplete line in buffer
    this.stdoutBuffer = lines.pop() || '';
    
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const message = JSON.parse(line) as MCPResponse | MCPRequest;
          
          // Handle responses
          if ('id' in message && ('result' in message || 'error' in message)) {
            const response = message as MCPResponse;
            const pending = this.pendingRequests.get(response.id);
            
            if (pending) {
              if (response.error) {
                pending.reject(new Error(response.error.message || JSON.stringify(response.error)));
              } else {
                pending.resolve(response.result);
              }
            }
          }
          
          // Handle notifications (no ID) - silently ignore
          if ('method' in message && !('id' in message)) {
            // Silently handle notifications
          }
          
        } catch (error) {
          // Silently ignore parse errors to prevent I/O overflow
        }
      }
  }
  
  /**
   * Handle MCP notifications (server-initiated messages)
   */
  private handleNotification(notification: MCPRequest): void {
    // Handle any server notifications if needed
    safeConsole.log('[MCP] Notification:', notification.method);
  }
  
  /**
   * Send a JSON-RPC request to MCP server
   */
  private async sendRequest(method: string, params: any): Promise<any> {
    if (!this.process) {
      throw new Error('MCP server process not started');
    }
    
    // Allow requests even if not marked as running (for initialization)
    if (!this.process.stdin || this.process.stdin.destroyed) {
      throw new Error('MCP server stdin not available');
    }
    
    const id = `req-${++this.requestIdCounter}`;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };
    
    return new Promise((resolve, reject) => {
      let timeout: NodeJS.Timeout;
      
      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        this.pendingRequests.delete(id);
      };
      
      this.pendingRequests.set(id, {
        resolve: (value) => {
          cleanup();
          resolve(value);
        },
        reject: (error) => {
          cleanup();
          reject(error);
        },
      });
      
      try {
        // Send request via stdin
        const requestLine = JSON.stringify(request) + '\n';
        this.process!.stdin?.write(requestLine);
      } catch (error) {
        cleanup();
        reject(new Error(`Failed to send request: ${error}`));
        return;
      }
      
      // Timeout after 15 seconds (reduced from 60 for faster feedback)
      timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          cleanup();
          reject(new Error(`Request timeout after 15s: ${method}`));
        }
      }, 15000);
    });
  }
  
  /**
   * Call an MCP tool
   */
  async callTool(toolName: string, args: object): Promise<any> {
    if (!this.process) {
      throw new Error('MCP server process not started');
    }
    
    if (this.process.killed) {
      throw new Error('MCP server process has been killed');
    }
    
    // Validate inputs
    if (!toolName || typeof toolName !== 'string') {
      throw new Error('toolName is required and must be a string');
    }
    
    if (!args || typeof args !== 'object') {
      throw new Error('args must be an object');
    }
    
    // Check if we have tools listed (indicates successful initialization)
    if (this.tools.length === 0 && !this.isRunning) {
      try {
        await this.retryInitialization();
      } catch (error) {
        // Silently ignore
      }
    }
    
    try {
      // Log tool call for debugging
      safeConsole.log(`[MCP] Calling tool: ${toolName}`, JSON.stringify(args).substring(0, 100));
      
      // MCP tools/call format
      const response = await this.sendRequest('tools/call', {
        name: toolName,
        arguments: args || {},
      });
      
      safeConsole.log(`[MCP] Tool ${toolName} response received:`, typeof response === 'object' ? JSON.stringify(response).substring(0, 200) : String(response).substring(0, 200));
      
      // Response might be nested in result.content or result directly
      if (response && typeof response === 'object') {
        if ('content' in response && Array.isArray(response.content)) {
          // MCP might return content array
          const content = response.content[0];
          if (content && 'text' in content) {
            return content.text;
          }
          return content || response;
        }
        if ('text' in response) {
          return response.text;
        }
        // Some tools return the result directly
        if ('result' in response) {
          return response.result;
        }
      }
      
      return response;
    } catch (error) {
      // Provide more helpful error message
      if (error instanceof Error && error.message.includes('timeout')) {
        safeConsole.error(`[MCP] Tool ${toolName} timed out. Check stderr for CDP connection issues.`);
        throw new Error(`MCP tool call timed out. Make sure browser tabs exist and CDP is accessible at http://127.0.0.1:9222. Original error: ${error.message}`);
      }
      safeConsole.error(`[MCP] Tool ${toolName} error:`, error);
      throw error;
    }
  }
  
  /**
   * List available tools
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.isRunning) {
      return [];
    }
    
    try {
      const response = await this.sendRequest('tools/list', {});
      return response?.tools || this.tools;
    } catch (error) {
      safeConsole.error('[MCP] Failed to list tools:', error);
      return this.tools; // Return cached tools
    }
  }
  
  /**
   * Get MCP server status
   */
  getStatus(): { running: boolean; toolCount: number } {
    return {
      running: this.isRunning,
      toolCount: this.tools.length,
    };
  }
  
  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.process) return;
    
    this.isRunning = false;
    
    // Try graceful shutdown
    this.process.kill('SIGTERM');
    
    // Force kill after 5 seconds
    setTimeout(() => {
      if (this.process && !this.process.killed) {
        this.process.kill('SIGKILL');
      }
    }, 5000);
    
    this.process = null;
    this.pendingRequests.clear();
  }
}

// Singleton instance
let mcpInstance: ChromeDevToolsMCP | null = null;

export function getMCPInstance(): ChromeDevToolsMCP {
  if (!mcpInstance) {
    mcpInstance = new ChromeDevToolsMCP();
  }
  return mcpInstance;
}
