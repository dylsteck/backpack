/**
 * Provider configuration system
 * Now uses OpenCode SDK for dynamic provider/model discovery
 */

import { getOpenCodeService, type Provider as OpenCodeProvider, type Model } from './opencode-service';

// Re-export types
export type { Model };

// Legacy type alias for backwards compatibility
export type Provider = string;

export interface ProviderConfig {
  id: string;
  name: string;
  displayName: string;
  models: Model[];
  keyHint?: string;
}

// Storage keys
export const PROVIDER_STORAGE_KEY = 'opencode-provider-id';
export const MODEL_STORAGE_KEY = 'opencode-model-id';

// Legacy PROVIDERS constant for backward compatibility
// Note: This is deprecated - use getProviderConfig() instead
export const PROVIDERS: Record<string, ProviderConfig> = {};

// Default fallback providers when OpenCode is not connected
const FALLBACK_PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    displayName: 'Anthropic',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    ],
    keyHint: 'Get your API key from console.anthropic.com',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    displayName: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    ],
    keyHint: 'Get your API key from platform.openai.com',
  },
];

/**
 * Get provider-specific model storage key
 */
export function getProviderModelKey(provider: string): string {
  return `opencode-model-${provider}`;
}

/**
 * Get all available providers from OpenCode
 */
export async function getProviders(): Promise<ProviderConfig[]> {
  const service = getOpenCodeService();
  const state = service.getState();
  
  return state.providers.map(p => ({
    id: p.id,
    name: p.name,
    displayName: p.name,
    models: p.models,
  }));
}

/**
 * Get all provider IDs
 */
export function getProviderIds(): string[] {
  const service = getOpenCodeService();
  const providers = service.getState().providers;
  
  // Fall back to default providers if OpenCode isn't connected
  if (providers.length === 0) {
    return FALLBACK_PROVIDERS.map(p => p.id);
  }
  
  return providers.map(p => p.id);
}

/**
 * Get provider config by ID
 * Returns a fallback config if OpenCode isn't connected
 */
export function getProviderConfig(providerId: string): ProviderConfig {
  const service = getOpenCodeService();
  const providers = service.getState().providers;
  
  // Check OpenCode providers first
  const provider = providers.find(p => p.id === providerId);
  if (provider) {
    return {
      id: provider.id,
      name: provider.name,
      displayName: provider.name,
      models: provider.models,
      keyHint: getProviderKeyHint(providerId),
    };
  }
  
  // Fall back to default providers
  const fallback = FALLBACK_PROVIDERS.find(p => p.id === providerId);
  if (fallback) {
    return fallback;
  }
  
  // Return a generic config as last resort
  return {
    id: providerId,
    name: providerId,
    displayName: providerId,
    models: [],
    keyHint: `Enter your ${providerId} API key`,
  };
}

/**
 * Get key hint for a provider
 */
function getProviderKeyHint(providerId: string): string {
  const hints: Record<string, string> = {
    anthropic: 'Get your API key from console.anthropic.com',
    openai: 'Get your API key from platform.openai.com',
    google: 'Get your API key from console.cloud.google.com',
    mistral: 'Get your API key from console.mistral.ai',
    groq: 'Get your API key from console.groq.com',
    cohere: 'Get your API key from dashboard.cohere.com',
    together: 'Get your API key from api.together.xyz',
    fireworks: 'Get your API key from fireworks.ai',
    perplexity: 'Get your API key from perplexity.ai',
    deepseek: 'Get your API key from platform.deepseek.com',
  };
  
  return hints[providerId] || `Enter your ${providerId} API key`;
}

/**
 * Validate API key format for a provider
 * Returns basic validation - OpenCode will do full validation
 */
export function validateApiKey(apiKey: string, _providerId: string): { valid: boolean; error?: string } {
  if (!apiKey || apiKey.trim().length === 0) {
    return { valid: false, error: 'API key is required' };
  }

  if (apiKey.length < 10) {
    return { valid: false, error: 'API key seems too short' };
  }

  return { valid: true };
}

/**
 * Get popular/featured providers for quick selection
 */
export function getFeaturedProviders(): string[] {
  return [
    'anthropic',
    'openai',
    'google',
    'mistral',
    'groq',
    'deepseek',
  ];
}

/**
 * Group providers by category
 */
export function getProvidersByCategory(): Record<string, ProviderConfig[]> {
  const service = getOpenCodeService();
  const providers = service.getState().providers;
  
  const categories: Record<string, string[]> = {
    'Featured': ['anthropic', 'openai', 'google', 'mistral'],
    'Fast & Affordable': ['groq', 'together', 'fireworks', 'deepseek'],
    'Specialized': ['cohere', 'perplexity', 'replicate'],
    'Open Source': ['ollama', 'lmstudio'],
  };
  
  const result: Record<string, ProviderConfig[]> = {};
  
  for (const [category, ids] of Object.entries(categories)) {
    const categoryProviders = providers
      .filter(p => ids.includes(p.id))
      .map(p => ({
        id: p.id,
        name: p.name,
        displayName: p.name,
        models: p.models,
        keyHint: getProviderKeyHint(p.id),
      }));
    
    if (categoryProviders.length > 0) {
      result[category] = categoryProviders;
    }
  }
  
  // Add remaining providers to "Other"
  const usedIds = Object.values(categories).flat();
  const otherProviders = providers
    .filter(p => !usedIds.includes(p.id))
    .map(p => ({
      id: p.id,
      name: p.name,
      displayName: p.name,
      models: p.models,
      keyHint: getProviderKeyHint(p.id),
    }));
  
  if (otherProviders.length > 0) {
    result['Other'] = otherProviders;
  }
  
  return result;
}
