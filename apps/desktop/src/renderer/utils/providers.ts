/**
 * Provider configuration system
 * Defines available AI providers and their models
 */

export type Provider = 'openrouter' | 'anthropic';

export interface ModelConfig {
  id: string;
  name: string;
  description?: string;
  contextWindow?: string;
}

export interface ProviderConfig {
  id: Provider;
  name: string;
  displayName: string;
  apiKeyStorageKey: string;
  defaultModel: string;
  models: ModelConfig[];
  keyPrefix?: string; // For validation
  keyHint: string;
}

export const PROVIDERS: Record<Provider, ProviderConfig> = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    displayName: 'OpenRouter',
    apiKeyStorageKey: 'cortex_openrouter_key',
    defaultModel: 'mistralai/devstral-2512:free',
    keyPrefix: 'sk-or-v1-',
    keyHint: 'Get your API key from openrouter.ai/keys',
    models: [
      { id: 'mistralai/devstral-2512:free', name: 'Mistral Devstral (Free)', contextWindow: '32k' },
      { id: 'google/gemini-2.0-flash-001:free', name: 'Gemini 2.0 Flash (Free)', contextWindow: '128k' },
      { id: 'meta-llama/llama-4-maverick:free', name: 'Llama 4 Maverick (Free)', contextWindow: '128k' },
      { id: 'openai/gpt-4o', name: 'GPT-4o', contextWindow: '128k' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', contextWindow: '200k' },
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', contextWindow: '200k' },
    ],
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    displayName: 'Anthropic (Direct)',
    apiKeyStorageKey: 'cortex_anthropic_key',
    defaultModel: 'claude-sonnet-4-5-20250929',
    keyPrefix: 'sk-ant-',
    keyHint: 'Get your API key from console.anthropic.com',
    models: [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', contextWindow: '200k' },
      { id: 'claude-opus-4-0-20250514', name: 'Claude Opus 4', contextWindow: '200k' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: '200k' },
    ],
  },
};

// Storage keys
export const PROVIDER_STORAGE_KEY = 'cortex-provider';

/**
 * Get provider-specific model storage key
 */
export function getProviderModelKey(provider: Provider): string {
  return `cortex-model-${provider}`;
}

/**
 * Get all provider IDs
 */
export function getProviderIds(): Provider[] {
  return Object.keys(PROVIDERS) as Provider[];
}

/**
 * Get provider config by ID
 */
export function getProviderConfig(provider: Provider): ProviderConfig {
  return PROVIDERS[provider];
}

/**
 * Validate API key format for a provider
 */
export function validateApiKey(apiKey: string, provider: Provider): { valid: boolean; error?: string } {
  const config = PROVIDERS[provider];
  
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key is required' };
  }

  if (config.keyPrefix && !apiKey.startsWith(config.keyPrefix)) {
    return { valid: false, error: `${config.displayName} keys start with "${config.keyPrefix}"` };
  }

  return { valid: true };
}

