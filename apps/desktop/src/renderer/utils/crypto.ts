/**
 * Crypto utilities for API key encryption
 * Uses Web Crypto API with AES-GCM for local storage encryption
 * 
 * Note: With OpenCode SDK integration, most API key management
 * is now handled by the OpenCode service. These utilities are kept
 * for backward compatibility and any local encryption needs.
 */

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
 * Get storage key for a provider
 */
function getStorageKey(providerId: string): string {
  return `cortex_${providerId}_key`;
}

/**
 * Encrypt and store API key for a specific provider
 */
export async function encryptApiKeyForProvider(apiKey: string, providerId: string): Promise<void> {
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
  
  const storageKey = getStorageKey(providerId);
  localStorage.setItem(storageKey, JSON.stringify(stored));
}

/**
 * Decrypt and retrieve API key for a specific provider
 */
export async function decryptApiKeyForProvider(providerId: string): Promise<string | null> {
  const storageKey = getStorageKey(providerId);
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
    console.error(`Failed to decrypt API key for ${providerId}:`, error);
    return null;
  }
}

/**
 * Check if API key exists for a specific provider
 */
export function hasApiKeyForProvider(providerId: string): boolean {
  const storageKey = getStorageKey(providerId);
  return localStorage.getItem(storageKey) !== null;
}

/**
 * Remove API key for a specific provider
 */
export function clearApiKeyForProvider(providerId: string): void {
  const storageKey = getStorageKey(providerId);
  localStorage.removeItem(storageKey);
}

// =============================================================================
// Generic encryption utilities
// =============================================================================

/**
 * Encrypt any string value
 */
export async function encryptValue(value: string): Promise<string> {
  const key = await deriveKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(value)
  );
  
  const stored = {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encryptedData)),
  };
  
  return JSON.stringify(stored);
}

/**
 * Decrypt an encrypted string value
 */
export async function decryptValue(encrypted: string): Promise<string | null> {
  try {
    const { iv, data } = JSON.parse(encrypted) as { iv: number[]; data: number[] };
    const key = await deriveKey();
    
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      new Uint8Array(data)
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    console.error('Failed to decrypt value:', error);
    return null;
  }
}
