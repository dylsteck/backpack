/**
 * OpenCode Service
 * Manages connection to OpenCode server (embedded or external)
 * Provides unified API for sessions, messages, and events
 */

import { createOpencodeClient } from '@opencode-ai/sdk';
import type { Session, Message, Part } from '@opencode-ai/sdk';

// Re-export types for convenience
export type { Session, Message, Part };

export type AuthMethod = 'oauth' | 'apikey' | 'zen';
export type OAuthProvider = 'github' | 'google';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// OpenCode OAuth configuration
const OPENCODE_AUTH_URL = 'https://opencode.ai/auth';
const OAUTH_CALLBACK_SCHEME = 'cortex';

export interface OpenCodeConfig {
  serverUrl: string;
  authMethod: AuthMethod;
  providerId?: string;
  modelId?: string;
}

export interface Provider {
  id: string;
  name: string;
  models: Model[];
}

export interface Model {
  id: string;
  name: string;
  contextWindow?: number;
}

export interface OpenCodeState {
  status: ConnectionStatus;
  serverUrl: string;
  authMethod: AuthMethod;
  isAuthenticated: boolean;
  currentProviderId: string | null;
  currentModelId: string | null;
  providers: Provider[];
  error: string | null;
}

// Storage keys
const STORAGE_KEYS = {
  SERVER_URL: 'opencode-server-url',
  AUTH_METHOD: 'opencode-auth-method',
  PROVIDER_ID: 'opencode-provider-id',
  MODEL_ID: 'opencode-model-id',
  API_KEYS: 'opencode-api-keys',
} as const;

// Default configuration
const DEFAULT_SERVER_URL = 'http://localhost:4096';
const DEFAULT_AUTH_METHOD: AuthMethod = 'apikey';

class OpenCodeService {
  private client: ReturnType<typeof createOpencodeClient> | null = null;
  private state: OpenCodeState = {
    status: 'disconnected',
    serverUrl: DEFAULT_SERVER_URL,
    authMethod: DEFAULT_AUTH_METHOD,
    isAuthenticated: false,
    currentProviderId: null,
    currentModelId: null,
    providers: [],
    error: null,
  };
  private listeners: Set<(state: OpenCodeState) => void> = new Set();
  private eventStream: AsyncIterableIterator<unknown> | null = null;
  private eventListeners: Map<string, Set<(event: unknown) => void>> = new Map();

  constructor() {
    this.loadPersistedState();
  }

  /**
   * Load persisted state from localStorage
   */
  private loadPersistedState(): void {
    try {
      const serverUrl = localStorage.getItem(STORAGE_KEYS.SERVER_URL);
      const authMethod = localStorage.getItem(STORAGE_KEYS.AUTH_METHOD) as AuthMethod | null;
      const providerId = localStorage.getItem(STORAGE_KEYS.PROVIDER_ID);
      const modelId = localStorage.getItem(STORAGE_KEYS.MODEL_ID);

      if (serverUrl) this.state.serverUrl = serverUrl;
      if (authMethod) this.state.authMethod = authMethod;
      if (providerId) this.state.currentProviderId = providerId;
      if (modelId) this.state.currentModelId = modelId;
    } catch (e) {
      console.warn('[OpenCodeService] Failed to load persisted state:', e);
    }
  }

  /**
   * Persist state to localStorage
   */
  private persistState(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SERVER_URL, this.state.serverUrl);
      localStorage.setItem(STORAGE_KEYS.AUTH_METHOD, this.state.authMethod);
      if (this.state.currentProviderId) {
        localStorage.setItem(STORAGE_KEYS.PROVIDER_ID, this.state.currentProviderId);
      }
      if (this.state.currentModelId) {
        localStorage.setItem(STORAGE_KEYS.MODEL_ID, this.state.currentModelId);
      }
    } catch (e) {
      console.warn('[OpenCodeService] Failed to persist state:', e);
    }
  }

  /**
   * Update state and notify listeners
   */
  private updateState(updates: Partial<OpenCodeState>): void {
    this.state = { ...this.state, ...updates };
    this.persistState();
    this.notifyListeners();
  }

  /**
   * Notify all state listeners
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (e) {
        console.error('[OpenCodeService] Listener error:', e);
      }
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: OpenCodeState) => void): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current state
   */
  getState(): OpenCodeState {
    return { ...this.state };
  }

  /**
   * Connect to OpenCode server
   */
  async connect(serverUrl?: string): Promise<boolean> {
    const url = serverUrl || this.state.serverUrl;
    
    this.updateState({ status: 'connecting', error: null });

    try {
      this.client = createOpencodeClient({
        baseUrl: url,
      });

      // Test connection - try health check first, but if it fails, try fetching providers directly
      try {
        const health = await this.client.global.health();
        if (health?.data?.healthy) {
          console.log('[OpenCodeService] Connected to OpenCode server:', health.data.version);
        }
      } catch (healthError) {
        // Health check might not be available or structured differently
        // Continue anyway and try to fetch providers
        console.warn('[OpenCodeService] Health check failed, continuing anyway:', healthError);
      }
      
      // Fetch providers to verify connection works
      await this.fetchProviders();
      
      this.updateState({
        status: 'connected',
        serverUrl: url,
        error: null,
      });
      
      return true;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Connection failed';
      console.error('[OpenCodeService] Connection error:', e);
      
      this.updateState({
        status: 'error',
        error: errorMessage,
      });
      
      return false;
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.client = null;
    this.eventStream = null;
    this.updateState({
      status: 'disconnected',
      isAuthenticated: false,
      error: null,
    });
  }

  /**
   * Fetch available providers and models
   */
  async fetchProviders(): Promise<Provider[]> {
    if (!this.client) {
      throw new Error('Not connected to OpenCode server');
    }

    try {
      const result = await this.client.config.providers();
      const providersData = result.data?.providers || [];
      const defaults = result.data?.default || {};

      // Transform to our Provider type
      const providers: Provider[] = providersData.map((p: { id: string; name?: string; models?: Array<{ id: string; name?: string; contextWindow?: number }> }) => ({
        id: p.id,
        name: p.name || p.id,
        models: (p.models || []).map((m: { id: string; name?: string; contextWindow?: number }) => ({
          id: m.id,
          name: m.name || m.id,
          contextWindow: m.contextWindow,
        })),
      }));

      // Set default provider/model if not set
      if (!this.state.currentProviderId && providers.length > 0) {
        const defaultProvider = Object.keys(defaults)[0] || providers[0].id;
        const defaultModel = defaults[defaultProvider] || providers[0].models[0]?.id;
        
        this.updateState({
          providers,
          currentProviderId: defaultProvider,
          currentModelId: defaultModel,
        });
      } else {
        this.updateState({ providers });
      }

      return providers;
    } catch (e) {
      console.error('[OpenCodeService] Failed to fetch providers:', e);
      throw e;
    }
  }

  /**
   * Set authentication method
   */
  setAuthMethod(method: AuthMethod): void {
    this.updateState({ authMethod: method });
  }

  /**
   * Set API key for a provider
   */
  async setApiKey(providerId: string, apiKey: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Not connected to OpenCode server');
    }

    try {
      await this.client.auth.set({
        path: { id: providerId },
        body: { type: 'api', key: apiKey },
      });
      
      this.updateState({ isAuthenticated: true });
      
      // Store encrypted key locally for persistence
      this.storeApiKey(providerId, apiKey);
      
      return true;
    } catch (e) {
      console.error('[OpenCodeService] Failed to set API key:', e);
      return false;
    }
  }

  /**
   * Store API key encrypted (simple base64 for now, should use proper encryption)
   */
  private storeApiKey(providerId: string, apiKey: string): void {
    try {
      const keys = JSON.parse(localStorage.getItem(STORAGE_KEYS.API_KEYS) || '{}');
      keys[providerId] = btoa(apiKey);
      localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(keys));
    } catch (e) {
      console.warn('[OpenCodeService] Failed to store API key:', e);
    }
  }

  /**
   * Get stored API key for a provider
   */
  getStoredApiKey(providerId: string): string | null {
    try {
      const keys = JSON.parse(localStorage.getItem(STORAGE_KEYS.API_KEYS) || '{}');
      return keys[providerId] ? atob(keys[providerId]) : null;
    } catch (e) {
      return null;
    }
  }

  // ============ OAuth Authentication ============

  /**
   * Initiate OAuth flow by opening browser
   * Returns a session token to track the auth flow
   */
  initiateOAuth(provider: OAuthProvider): string {
    const sessionToken = crypto.randomUUID();
    const callbackUrl = `${OAUTH_CALLBACK_SCHEME}://opencode-auth`;
    
    // Build OAuth URL with callback
    const oauthUrl = new URL(OPENCODE_AUTH_URL);
    oauthUrl.searchParams.set('provider', provider);
    oauthUrl.searchParams.set('callback', callbackUrl);
    oauthUrl.searchParams.set('session', sessionToken);
    
    // Open in default browser
    if (typeof window !== 'undefined') {
      window.open(oauthUrl.toString(), '_blank');
    }
    
    console.log('[OpenCodeService] Initiated OAuth flow:', provider, sessionToken);
    return sessionToken;
  }

  /**
   * Handle OAuth callback data from deep link
   */
  async handleOAuthCallback(data: {
    success: boolean;
    token?: string;
    provider?: string;
    error?: string;
  }): Promise<boolean> {
    if (!data.success || !data.token) {
      console.error('[OpenCodeService] OAuth callback failed:', data.error);
      this.updateState({ 
        isAuthenticated: false,
        error: data.error || 'OAuth authentication failed',
      });
      return false;
    }

    try {
      // Store the OAuth token
      localStorage.setItem('opencode-oauth-token', data.token);
      if (data.provider) {
        localStorage.setItem('opencode-oauth-provider', data.provider);
      }
      
      this.updateState({ 
        isAuthenticated: true,
        error: null,
      });
      
      console.log('[OpenCodeService] OAuth authentication successful');
      return true;
    } catch (e) {
      console.error('[OpenCodeService] Failed to handle OAuth callback:', e);
      return false;
    }
  }

  /**
   * Check if user is authenticated via OAuth
   */
  hasOAuthToken(): boolean {
    return !!localStorage.getItem('opencode-oauth-token');
  }

  /**
   * Get OAuth token if available
   */
  getOAuthToken(): string | null {
    return localStorage.getItem('opencode-oauth-token');
  }

  /**
   * Clear OAuth authentication
   */
  clearOAuth(): void {
    localStorage.removeItem('opencode-oauth-token');
    localStorage.removeItem('opencode-oauth-provider');
    this.updateState({ isAuthenticated: false });
  }

  /**
   * Set current provider
   */
  setProvider(providerId: string): void {
    const provider = this.state.providers.find(p => p.id === providerId);
    if (provider) {
      this.updateState({
        currentProviderId: providerId,
        currentModelId: provider.models[0]?.id || null,
      });
    }
  }

  /**
   * Set current model
   */
  setModel(modelId: string): void {
    this.updateState({ currentModelId: modelId });
  }

  /**
   * Get current provider config
   */
  getCurrentProvider(): Provider | null {
    return this.state.providers.find(p => p.id === this.state.currentProviderId) || null;
  }

  /**
   * Get current model config
   */
  getCurrentModel(): Model | null {
    const provider = this.getCurrentProvider();
    return provider?.models.find(m => m.id === this.state.currentModelId) || null;
  }

  // ============ Session Management ============

  /**
   * Create a new chat session
   */
  async createSession(title?: string): Promise<Session | null> {
    if (!this.client) {
      throw new Error('Not connected to OpenCode server');
    }

    try {
      const result = await this.client.session.create({
        body: { title: title || 'New Chat' },
      });
      return result.data as Session;
    } catch (e) {
      console.error('[OpenCodeService] Failed to create session:', e);
      return null;
    }
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<Session[]> {
    if (!this.client) {
      throw new Error('Not connected to OpenCode server');
    }

    try {
      const result = await this.client.session.list();
      return (result.data || []) as Session[];
    } catch (e) {
      console.error('[OpenCodeService] Failed to list sessions:', e);
      return [];
    }
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId: string): Promise<Session | null> {
    if (!this.client) {
      throw new Error('Not connected to OpenCode server');
    }

    try {
      const result = await this.client.session.get({
        path: { id: sessionId },
      });
      return result.data as Session;
    } catch (e) {
      console.error('[OpenCodeService] Failed to get session:', e);
      return null;
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('Not connected to OpenCode server');
    }

    try {
      await this.client.session.delete({
        path: { id: sessionId },
      });
      return true;
    } catch (e) {
      console.error('[OpenCodeService] Failed to delete session:', e);
      return false;
    }
  }

  /**
   * Get messages for a session
   */
  async getMessages(sessionId: string): Promise<Array<{ info: Message; parts: Part[] }>> {
    if (!this.client) {
      throw new Error('Not connected to OpenCode server');
    }

    try {
      const result = await this.client.session.messages({
        path: { id: sessionId },
      });
      return (result.data || []) as Array<{ info: Message; parts: Part[] }>;
    } catch (e) {
      console.error('[OpenCodeService] Failed to get messages:', e);
      return [];
    }
  }

  /**
   * Send a prompt to a session
   */
  async sendPrompt(
    sessionId: string,
    content: string,
    options?: { noReply?: boolean }
  ): Promise<Message | null> {
    if (!this.client) {
      throw new Error('Not connected to OpenCode server');
    }

    if (!this.state.currentProviderId || !this.state.currentModelId) {
      throw new Error('No provider/model selected');
    }

    try {
      const result = await this.client.session.prompt({
        path: { id: sessionId },
        body: {
          model: {
            providerID: this.state.currentProviderId,
            modelID: this.state.currentModelId,
          },
          parts: [{ type: 'text', text: content }],
          noReply: options?.noReply,
        },
      });
      return result.data as Message;
    } catch (e) {
      console.error('[OpenCodeService] Failed to send prompt:', e);
      throw e;
    }
  }

  /**
   * Send a prompt with streaming response via callback
   * This provides real-time text updates as the response streams in
   */
  async sendPromptStreaming(
    sessionId: string,
    content: string,
    callbacks: {
      onChunk?: (text: string, fullText: string) => void;
      onComplete?: (fullText: string) => void;
      onError?: (error: Error) => void;
      onToolUse?: (toolName: string, toolInput: unknown) => void;
    }
  ): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to OpenCode server');
    }

    if (!this.state.currentProviderId || !this.state.currentModelId) {
      throw new Error('No provider/model selected');
    }

    let fullText = '';

    try {
      // Subscribe to events before sending prompt
      const events = await this.client.event.subscribe();
      
      // Send the prompt (this triggers events)
      const promptPromise = this.client.session.prompt({
        path: { id: sessionId },
        body: {
          model: {
            providerID: this.state.currentProviderId,
            modelID: this.state.currentModelId,
          },
          parts: [{ type: 'text', text: content }],
        },
      });

      // Process events stream
      for await (const event of events.stream as AsyncIterableIterator<{ type?: string; properties?: Record<string, unknown> }>) {
        if (!event || !event.type) continue;

        // Handle text delta events
        if (event.type === 'message.part.text.delta' || event.type === 'text_delta') {
          const delta = (event.properties?.delta as string) || (event.properties?.text as string) || '';
          if (delta) {
            fullText += delta;
            callbacks.onChunk?.(delta, fullText);
          }
        }

        // Handle tool use events
        if (event.type === 'tool_use' || event.type === 'message.part.tool_use') {
          const toolName = event.properties?.name as string;
          const toolInput = event.properties?.input;
          callbacks.onToolUse?.(toolName, toolInput);
        }

        // Handle completion
        if (event.type === 'message.stop' || event.type === 'message_stop') {
          break;
        }
      }

      // Wait for prompt to complete
      await promptPromise;
      
      callbacks.onComplete?.(fullText);
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Unknown error');
      console.error('[OpenCodeService] Streaming prompt error:', error);
      callbacks.onError?.(error);
    }
  }

  // ============ Event Streaming ============

  /**
   * Subscribe to real-time events
   */
  async subscribeToEvents(): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to OpenCode server');
    }

    try {
      const events = await this.client.event.subscribe();
      this.eventStream = events.stream as AsyncIterableIterator<unknown>;
      
      // Process events in background
      this.processEvents();
    } catch (e) {
      console.error('[OpenCodeService] Failed to subscribe to events:', e);
    }
  }

  /**
   * Process incoming events
   */
  private async processEvents(): Promise<void> {
    if (!this.eventStream) return;

    try {
      for await (const event of this.eventStream) {
        this.handleEvent(event);
      }
    } catch (e) {
      console.error('[OpenCodeService] Event stream error:', e);
    }
  }

  /**
   * Handle a single event
   */
  private handleEvent(event: unknown): void {
    const e = event as { type?: string };
    const eventType = e.type || 'unknown';
    const listeners = this.eventListeners.get(eventType);
    
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (err) {
          console.error('[OpenCodeService] Event listener error:', err);
        }
      }
    }

    // Also notify "all" listeners
    const allListeners = this.eventListeners.get('*');
    if (allListeners) {
      for (const listener of allListeners) {
        try {
          listener(event);
        } catch (err) {
          console.error('[OpenCodeService] Event listener error:', err);
        }
      }
    }
  }

  /**
   * Add event listener
   */
  addEventListener(eventType: string, listener: (event: unknown) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
    
    return () => {
      this.eventListeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.client !== null && this.state.status === 'connected';
  }
}

// Singleton instance
let instance: OpenCodeService | null = null;

export function getOpenCodeService(): OpenCodeService {
  if (!instance) {
    instance = new OpenCodeService();
  }
  return instance;
}

export { OpenCodeService };
