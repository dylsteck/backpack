/**
 * Crypto utilities for API key encryption
 * Uses Web Crypto API with AES-GCM for local storage encryption
 * 
 * Supports multiple providers with provider-specific storage keys
 */

import { type Provider, getProviderConfig } from './providers';

const SALT = 'cortex-local-encryption-salt-v1';

/**
 * Derive an encryption key from a static salt
 * Note: This provides obfuscation, not security against determined attackers
 */
async function deriveKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SALT),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('cortex-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt and store API key for a specific provider
 */
export async function encryptApiKeyForProvider(apiKey: string, provider: Provider): Promise<void> {
  const key = await deriveKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(apiKey)
  );
  
  // Store IV and encrypted data as base64
  const stored = {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encryptedData)),
  };
  
  const storageKey = getProviderConfig(provider).apiKeyStorageKey;
  localStorage.setItem(storageKey, JSON.stringify(stored));
}

/**
 * Decrypt and retrieve API key for a specific provider
 */
export async function decryptApiKeyForProvider(provider: Provider): Promise<string | null> {
  const storageKey = getProviderConfig(provider).apiKeyStorageKey;
  const stored = localStorage.getItem(storageKey);
  if (!stored) return null;
  
  try {
    const { iv, data } = JSON.parse(stored) as { iv: number[]; data: number[] };
    const key = await deriveKey();
    
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(data)
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error(`Failed to decrypt API key for ${provider}:`, error);
    return null;
  }
}

/**
 * Check if API key exists for a specific provider
 */
export function hasApiKeyForProvider(provider: Provider): boolean {
  const storageKey = getProviderConfig(provider).apiKeyStorageKey;
  return localStorage.getItem(storageKey) !== null;
}

/**
 * Remove API key for a specific provider
 */
export function clearApiKeyForProvider(provider: Provider): void {
  const storageKey = getProviderConfig(provider).apiKeyStorageKey;
  localStorage.removeItem(storageKey);
}

// =============================================================================
// Backward compatible wrappers (default to OpenRouter)
// =============================================================================

/**
 * Encrypt and store API key in localStorage (defaults to OpenRouter)
 */
export async function encryptApiKey(apiKey: string): Promise<void> {
  return encryptApiKeyForProvider(apiKey, 'openrouter');
}

/**
 * Decrypt and retrieve API key from localStorage (defaults to OpenRouter)
 */
export async function decryptApiKey(): Promise<string | null> {
  return decryptApiKeyForProvider('openrouter');
}

/**
 * Check if API key exists in storage (defaults to OpenRouter)
 */
export function hasApiKey(): boolean {
  return hasApiKeyForProvider('openrouter');
}

/**
 * Remove API key from storage (defaults to OpenRouter)
 */
export function clearApiKey(): void {
  clearApiKeyForProvider('openrouter');
}

