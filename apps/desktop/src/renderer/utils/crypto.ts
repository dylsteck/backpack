/**
 * Crypto utilities for API key encryption
 * Uses Web Crypto API with AES-GCM for local storage encryption
 */

const STORAGE_KEY = 'cortex_openrouter_key';
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
 * Encrypt and store API key in localStorage
 */
export async function encryptApiKey(apiKey: string): Promise<void> {
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
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

/**
 * Decrypt and retrieve API key from localStorage
 */
export async function decryptApiKey(): Promise<string | null> {
  const stored = localStorage.getItem(STORAGE_KEY);
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
    console.error('Failed to decrypt API key:', error);
    return null;
  }
}

/**
 * Check if API key exists in storage
 */
export function hasApiKey(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Remove API key from storage
 */
export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

