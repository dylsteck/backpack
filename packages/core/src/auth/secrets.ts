import fs from "fs";
import path from "path";
import os from "os";

const SECRETS_FILE = "secrets.json";

function getSecretsPath(): string {
	const configDir = path.join(os.homedir(), ".config", "backpack");
	return path.join(configDir, SECRETS_FILE);
}

function ensureSecretsDir(): void {
	const dir = path.dirname(getSecretsPath());
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
	}
}

function readSecrets(): Record<string, string> {
	const secretsPath = getSecretsPath();
	try {
		if (!fs.existsSync(secretsPath)) {
			return {};
		}
		const data = fs.readFileSync(secretsPath, "utf-8");
		return JSON.parse(data) as Record<string, string>;
	} catch {
		return {};
	}
}

function writeSecrets(secrets: Record<string, string>): void {
	ensureSecretsDir();
	const secretsPath = getSecretsPath();
	const tmpPath = secretsPath + ".tmp";

	// Atomic write: write to temp file then rename
	fs.writeFileSync(tmpPath, JSON.stringify(secrets, null, 2), {
		encoding: "utf-8",
		mode: 0o600,
	});
	fs.renameSync(tmpPath, secretsPath);
}

export const SECRET_KEYS = {
	OPENROUTER_API_KEY: "openrouter-api-key",
	TELLER_ACCESS_TOKEN: "teller-access-token",
	FARCASTER_SIGNER: "farcaster-signer",
	FARCASTER_FID: "farcaster-fid",
} as const;

export type SecretKey = (typeof SECRET_KEYS)[keyof typeof SECRET_KEYS];

export async function getSecret(key: string): Promise<string | null> {
	const secrets = readSecrets();
	return secrets[key] ?? null;
}

export async function setSecret(key: string, value: string): Promise<void> {
	const secrets = readSecrets();
	secrets[key] = value;
	writeSecrets(secrets);
}

export async function deleteSecret(key: string): Promise<void> {
	const secrets = readSecrets();
	delete secrets[key];
	writeSecrets(secrets);
}

export async function hasSecret(key: string): Promise<boolean> {
	const secrets = readSecrets();
	return key in secrets;
}

export async function getAllSecretKeys(): Promise<string[]> {
	const secrets = readSecrets();
	return Object.keys(secrets);
}

// Convenience functions for well-known secrets

export async function getOpenRouterKey(): Promise<string | null> {
	return getSecret(SECRET_KEYS.OPENROUTER_API_KEY);
}

export async function setOpenRouterKey(key: string): Promise<void> {
	return setSecret(SECRET_KEYS.OPENROUTER_API_KEY, key);
}

export async function deleteOpenRouterKey(): Promise<void> {
	return deleteSecret(SECRET_KEYS.OPENROUTER_API_KEY);
}

export async function getTellerToken(): Promise<string | null> {
	return getSecret(SECRET_KEYS.TELLER_ACCESS_TOKEN);
}

export async function setTellerToken(token: string): Promise<void> {
	return setSecret(SECRET_KEYS.TELLER_ACCESS_TOKEN, token);
}

export async function deleteTellerToken(): Promise<void> {
	return deleteSecret(SECRET_KEYS.TELLER_ACCESS_TOKEN);
}

export async function getFarcasterSigner(): Promise<string | null> {
	return getSecret(SECRET_KEYS.FARCASTER_SIGNER);
}

export async function setFarcasterSigner(signer: string): Promise<void> {
	return setSecret(SECRET_KEYS.FARCASTER_SIGNER, signer);
}

export async function deleteFarcasterSigner(): Promise<void> {
	return deleteSecret(SECRET_KEYS.FARCASTER_SIGNER);
}

export async function getFarcasterFid(): Promise<string | null> {
	return getSecret(SECRET_KEYS.FARCASTER_FID);
}

export async function setFarcasterFid(fid: string): Promise<void> {
	return setSecret(SECRET_KEYS.FARCASTER_FID, fid);
}

export async function deleteFarcasterFid(): Promise<void> {
	return deleteSecret(SECRET_KEYS.FARCASTER_FID);
}
