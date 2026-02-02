/**
 * Crypto utilities for generic encryption
 * Uses Web Crypto API with AES-GCM for local storage encryption
 * 
 * Note: API key management is now handled by the OpenCode service.
 * These generic utilities are kept for any other local encryption needs.
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
