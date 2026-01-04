/**
 * Chat State Manager
 * Centralized state management for multi-provider chat
 */

import { 
  type Provider, 
  PROVIDERS, 
  PROVIDER_STORAGE_KEY, 
  getProviderModelKey,
  getProviderConfig 
} from './providers';

/**
 * Manages chat provider and model state
 */
export class ChatStateManager {
  constructor() {
    this.migrateExistingData();
  }

  /**
   * Get the currently selected provider
   */
  getProvider(): Provider {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (stored && (stored === 'openrouter' || stored === 'anthropic')) {
      return stored;
    }
    return 'openrouter'; // Default
  }

  /**
   * Set the current provider and optionally reset to default model
   */
  setProvider(provider: Provider, resetModel = true): void {
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
    
    if (resetModel) {
      // Set to default model for the new provider if no model is saved
      const modelKey = getProviderModelKey(provider);
      if (!localStorage.getItem(modelKey)) {
        const defaultModel = PROVIDERS[provider].defaultModel;
        localStorage.setItem(modelKey, defaultModel);
      }
    }
  }

  /**
   * Get the model for a specific provider
   */
  getModel(provider: Provider): string {
    const key = getProviderModelKey(provider);
    return localStorage.getItem(key) || PROVIDERS[provider].defaultModel;
  }

  /**
   * Get the model for the current provider
   */
  getCurrentModel(): string {
    return this.getModel(this.getProvider());
  }

  /**
   * Set the model for a specific provider
   */
  setModel(provider: Provider, model: string): void {
    const key = getProviderModelKey(provider);
    localStorage.setItem(key, model);
  }

  /**
   * Set the model for the current provider
   */
  setCurrentModel(model: string): void {
    this.setModel(this.getProvider(), model);
  }

  /**
   * Get the API endpoint for a specific provider
   */
  getEndpoint(provider: Provider, serverPort: number): string {
    return `http://localhost:${serverPort}/api/chat/${provider}`;
  }

  /**
   * Get the API endpoint for the current provider
   */
  getCurrentEndpoint(serverPort: number): string {
    return this.getEndpoint(this.getProvider(), serverPort);
  }

  /**
   * Get provider config for current provider
   */
  getCurrentProviderConfig() {
    return getProviderConfig(this.getProvider());
  }

  /**
   * Migrate existing users' data to new multi-provider format
   */
  private migrateExistingData(): void {
    // Check if migration is needed
    const hasProviderSet = localStorage.getItem(PROVIDER_STORAGE_KEY) !== null;
    
    // If provider is already set, no migration needed
    if (hasProviderSet) return;

    // Check for existing OpenRouter key (old format)
    const hasOldKey = localStorage.getItem('cortex_openrouter_key') !== null;
    
    if (hasOldKey) {
      // User has existing OpenRouter setup, set them as OpenRouter provider
      localStorage.setItem(PROVIDER_STORAGE_KEY, 'openrouter');
      console.log('[ChatStateManager] Migrated existing user to OpenRouter provider');
    }

    // Migrate old model key to provider-specific key
    const existingModel = localStorage.getItem('cortex-model');
    const newOpenRouterModelKey = getProviderModelKey('openrouter');
    
    if (existingModel && !localStorage.getItem(newOpenRouterModelKey)) {
      localStorage.setItem(newOpenRouterModelKey, existingModel);
      console.log('[ChatStateManager] Migrated existing model preference');
    }
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

