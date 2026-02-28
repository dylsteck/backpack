import keytar from "keytar";

// Re-export keytar types
export { keytar };

/**
 * Service name for all backpack secrets
 */
const SERVICE_NAME = "backpack";

/**
 * Well-known secret keys
 */
export const SECRET_KEYS = {
  OPENROUTER_API_KEY: "openrouter-api-key",
  TELLER_ACCESS_TOKEN: "teller-access-token",
  FARCASTER_SIGNER: "farcaster-signer",
  FARCASTER_FID: "farcaster-fid",
} as const;

export type SecretKey = typeof SECRET_KEYS[keyof typeof SECRET_KEYS];

/**
 * Get a secret from the OS keychain
 * @param key - The secret key
 * @returns The secret value or null if not found
 */
export async function getSecret(key: string): Promise<string | null> {
  try {
    return await keytar.getPassword(SERVICE_NAME, key);
  } catch (error) {
    console.error(`Failed to get secret '${key}':`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Set a secret in the OS keychain
 * Overwrites if the key already exists
 * @param key - The secret key
 * @param value - The secret value
 */
export async function setSecret(key: string, value: string): Promise<void> {
  try {
    await keytar.setPassword(SERVICE_NAME, key, value);
  } catch (error) {
    console.error(`Failed to set secret '${key}':`, error instanceof Error ? error.message : error);
    throw new Error(`Failed to store secret: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Delete a secret from the OS keychain
 * @param key - The secret key
 */
export async function deleteSecret(key: string): Promise<void> {
  try {
    await keytar.deletePassword(SERVICE_NAME, key);
  } catch (error) {
    console.error(`Failed to delete secret '${key}':`, error instanceof Error ? error.message : error);
    throw new Error(`Failed to delete secret: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if a secret exists in the keychain
 * @param key - The secret key
 */
export async function hasSecret(key: string): Promise<boolean> {
  const secret = await getSecret(key);
  return secret !== null;
}

/**
 * Get all secret keys stored for backpack
 */
export async function getAllSecretKeys(): Promise<string[]> {
  try {
    const credentials = await keytar.findCredentials(SERVICE_NAME);
    return credentials.map(cred => cred.account);
  } catch (error) {
    console.error("Failed to get all secrets:", error instanceof Error ? error.message : error);
    return [];
  }
}

// Convenience functions for well-known secrets

/**
 * Get OpenRouter API key
 */
export async function getOpenRouterKey(): Promise<string | null> {
  return getSecret(SECRET_KEYS.OPENROUTER_API_KEY);
}

/**
 * Set OpenRouter API key
 */
export async function setOpenRouterKey(key: string): Promise<void> {
  return setSecret(SECRET_KEYS.OPENROUTER_API_KEY, key);
}

/**
 * Delete OpenRouter API key
 */
export async function deleteOpenRouterKey(): Promise<void> {
  return deleteSecret(SECRET_KEYS.OPENROUTER_API_KEY);
}

/**
 * Get Teller access token
 */
export async function getTellerToken(): Promise<string | null> {
  return getSecret(SECRET_KEYS.TELLER_ACCESS_TOKEN);
}

/**
 * Set Teller access token
 */
export async function setTellerToken(token: string): Promise<void> {
  return setSecret(SECRET_KEYS.TELLER_ACCESS_TOKEN, token);
}

/**
 * Delete Teller access token
 */
export async function deleteTellerToken(): Promise<void> {
  return deleteSecret(SECRET_KEYS.TELLER_ACCESS_TOKEN);
}

/**
 * Get Farcaster signer
 */
export async function getFarcasterSigner(): Promise<string | null> {
  return getSecret(SECRET_KEYS.FARCASTER_SIGNER);
}

/**
 * Set Farcaster signer
 */
export async function setFarcasterSigner(signer: string): Promise<void> {
  return setSecret(SECRET_KEYS.FARCASTER_SIGNER, signer);
}

/**
 * Delete Farcaster signer
 */
export async function deleteFarcasterSigner(): Promise<void> {
  return deleteSecret(SECRET_KEYS.FARCASTER_SIGNER);
}

/**
 * Get Farcaster FID
 */
export async function getFarcasterFid(): Promise<string | null> {
  return getSecret(SECRET_KEYS.FARCASTER_FID);
}

/**
 * Set Farcaster FID
 */
export async function setFarcasterFid(fid: string): Promise<void> {
  return setSecret(SECRET_KEYS.FARCASTER_FID, fid);
}

/**
 * Delete Farcaster FID
 */
export async function deleteFarcasterFid(): Promise<void> {
  return deleteSecret(SECRET_KEYS.FARCASTER_FID);
}
