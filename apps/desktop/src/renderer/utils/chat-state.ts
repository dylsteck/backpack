/**
 * Chat State Manager
 * Centralized state management using OpenCode SDK
 */

import { 
  getOpenCodeService, 
  type AuthMethod, 
  type OpenCodeState,
  type Provider,
  type Model,
} from './opencode-service';

// Re-export types
export type { AuthMethod, OpenCodeState, Provider, Model };

/**
 * Manages chat provider and model state via OpenCode
 */
export class ChatStateManager {
  private service = getOpenCodeService();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    // Auto-connect on initialization
    this.initializeConnection();
  }

  /**
   * Initialize connection to OpenCode server
   */
  private async initializeConnection(): Promise<void> {
    try {
      const connected = await this.service.connect();
      if (connected) {
        console.log('[ChatStateManager] Connected to OpenCode');
        // Restore API keys from storage
        await this.restoreApiKeys();
      }
    } catch (e) {
      console.warn('[ChatStateManager] Failed to connect:', e);
    }
  }

  /**
   * Restore API keys from local storage
   */
  private async restoreApiKeys(): Promise<void> {
    const state = this.service.getState();
    for (const provider of state.providers) {
      const storedKey = this.service.getStoredApiKey(provider.id);
      if (storedKey) {
        try {
          await this.service.setApiKey(provider.id, storedKey);
        } catch (e) {
          console.warn(`[ChatStateManager] Failed to restore key for ${provider.id}:`, e);
        }
      }
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: OpenCodeState) => void): () => void {
    return this.service.subscribe(listener);
  }

  /**
   * Get current state
   */
  getState(): OpenCodeState {
    return this.service.getState();
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.service.isReady();
  }

  /**
   * Get the currently selected provider ID
   */
  getProvider(): string {
    return this.service.getState().currentProviderId || 'anthropic';
  }

  /**
   * Set the current provider
   */
  setProvider(providerId: string): void {
    this.service.setProvider(providerId);
  }

  /**
   * Get the model for the current provider
   */
  getModel(providerId?: string): string {
    const state = this.service.getState();
    if (providerId && providerId !== state.currentProviderId) {
      const provider = state.providers.find(p => p.id === providerId);
      return provider?.models[0]?.id || '';
    }
    return state.currentModelId || '';
  }

  /**
   * Get the model for the current provider
   */
  getCurrentModel(): string {
    return this.service.getState().currentModelId || '';
  }

  /**
   * Set the model for a specific provider
   */
  setModel(_providerId: string, modelId: string): void {
    this.service.setModel(modelId);
  }

  /**
   * Set the model for the current provider
   */
  setCurrentModel(modelId: string): void {
    this.service.setModel(modelId);
  }

  /**
   * Get auth method
   */
  getAuthMethod(): AuthMethod {
    return this.service.getState().authMethod;
  }

  /**
   * Set auth method
   */
  setAuthMethod(method: AuthMethod): void {
    this.service.setAuthMethod(method);
  }

  /**
   * Set API key for a provider
   */
  async setApiKey(providerId: string, apiKey: string): Promise<boolean> {
    return this.service.setApiKey(providerId, apiKey);
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.service.getState().isAuthenticated;
  }

  /**
   * Get available providers
   */
  getProviders(): Provider[] {
    return this.service.getState().providers;
  }

  /**
   * Get models for a provider
   */
  getModels(providerId: string): Model[] {
    const provider = this.service.getState().providers.find(p => p.id === providerId);
    return provider?.models || [];
  }

  /**
   * Get current provider config
   */
  getCurrentProviderConfig(): Provider | null {
    return this.service.getCurrentProvider();
  }

  /**
   * Get current model config
   */
  getCurrentModelConfig(): Model | null {
    return this.service.getCurrentModel();
  }

  /**
   * Get the API endpoint - now uses OpenCode SDK directly
   * This is kept for backwards compatibility but messages go through the SDK
   */
  getEndpoint(_providerId: string, _serverPort: number): string {
    // OpenCode SDK handles this internally
    return this.service.getState().serverUrl;
  }

  /**
   * Get the API endpoint for the current provider
   */
  getCurrentEndpoint(serverPort: number): string {
    return this.getEndpoint(this.getProvider(), serverPort);
  }

  /**
   * Get server URL
   */
  getServerUrl(): string {
    return this.service.getState().serverUrl;
  }

  /**
   * Connect to a different server
   */
  async connectToServer(serverUrl: string): Promise<boolean> {
    return this.service.connect(serverUrl);
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.service.disconnect();
  }
}

// Singleton instance
let instance: ChatStateManager | null = null;

export function getChatStateManager(): ChatStateManager {
  if (!instance) {
    instance = new ChatStateManager();
  }
  return instance;
}
