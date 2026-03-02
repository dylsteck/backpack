/**
 * Simple credential encryption/decryption utilities.
 * Uses AES-256-GCM encryption with a key from environment or default.
 * 
 * For production, ensure CREDENTIAL_ENCRYPTION_KEY is set in environment.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // For GCM, this is typically 12 but 16 works
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get or generate encryption key
 */
function getEncryptionKey(): Buffer {
	const envKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
	if (envKey) {
		// Use provided key, hash it to ensure it's the right length
		return crypto.createHash("sha256").update(envKey).digest();
	}
	
	// For development, use a default key (NOT SECURE for production!)
	// In production, CREDENTIAL_ENCRYPTION_KEY must be set
	console.warn("⚠️  Using default encryption key. Set CREDENTIAL_ENCRYPTION_KEY for production!");
	return crypto.createHash("sha256").update("backpack-default-key-change-in-production").digest();
}

/**
 * Encrypt credentials (API key or OAuth tokens)
 */
export function encryptCredentials(credentials: string): string {
	try {
		const key = getEncryptionKey();
		const iv = crypto.randomBytes(IV_LENGTH);
		const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
		
		let encrypted = cipher.update(credentials, "utf8", "base64");
		encrypted += cipher.final("base64");
		
		const authTag = cipher.getAuthTag();
		
		// Combine IV + AuthTag + Encrypted data
		const combined = Buffer.concat([
			iv,
			authTag,
			Buffer.from(encrypted, "base64")
		]);
		
		return combined.toString("base64");
	} catch (error) {
		console.error("Encryption error:", error);
		throw new Error("Failed to encrypt credentials");
	}
}

/**
 * Decrypt credentials
 */
export function decryptCredentials(encryptedData: string): string {
	try {
		const key = getEncryptionKey();
		const combined = Buffer.from(encryptedData, "base64");
		
		// Extract IV, AuthTag, and encrypted data
		const iv = combined.subarray(0, IV_LENGTH);
		const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
		const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);
		
		const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);
		
		let decrypted = decipher.update(encrypted, undefined, "utf8");
		decrypted += decipher.final("utf8");
		
		return decrypted;
	} catch (error) {
		console.error("Decryption error:", error);
		throw new Error("Failed to decrypt credentials");
	}
}

