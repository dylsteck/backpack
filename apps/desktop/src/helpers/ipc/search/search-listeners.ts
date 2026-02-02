/**
 * Search IPC Listeners
 * Handles search operations in the main process
 */

import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { SEARCH_CHANNELS } from './search-channels';

/**
 * Execute a CLI command and return the result
 */
async function execCli(
	cmd: string,
	args: string[],
	options?: { timeoutMs?: number }
): Promise<{ success: boolean; data?: unknown; error?: string }> {
	return new Promise((resolve) => {
		// Ensure Bun's bin directory is in PATH for cortex CLI
		const bunBinPath = path.join(os.homedir(), '.bun', 'bin');
		const currentPath = process.env.PATH || '';
		const env = {
			...process.env,
			PATH: currentPath.includes(bunBinPath) ? currentPath : `${bunBinPath}:${currentPath}`,
		};

		const proc = spawn(cmd, args, {
			stdio: ['ignore', 'pipe', 'pipe'],
			env,
			shell: true,
		});

		let stdout = '';
		let stderr = '';
		let timedOut = false;
		const timeoutMs = options?.timeoutMs;
		const timeout = timeoutMs
			? setTimeout(() => {
					timedOut = true;
					proc.kill('SIGKILL');
			  }, timeoutMs)
			: null;

		proc.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		proc.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		proc.on('close', (code) => {
			if (timeout) clearTimeout(timeout);
			if (timedOut) {
				resolve({ success: false, error: `Command timed out after ${timeoutMs}ms` });
				return;
			}
			if (code !== 0) {
				resolve({ success: false, error: stderr || `Exit code: ${code}` });
				return;
			}
			try {
				// Try to find JSON in stdout (in case there are other logs)
				const jsonMatch = stdout.match(/\{[\s\S]*\}/);
				const jsonStr = jsonMatch ? jsonMatch[0] : stdout.trim();
				const parsed = JSON.parse(jsonStr);
				resolve({ success: true, data: parsed });
			} catch (err) {
				console.error('[Search] Failed to parse JSON:', stdout);
				resolve({ success: false, error: `Failed to parse JSON: ${err instanceof Error ? err.message : 'Unknown error'}` });
			}
		});

		proc.on('error', (err) => {
			if (timeout) clearTimeout(timeout);
			resolve({ success: false, error: err.message });
		});
	});
}

/**
 * Register search IPC listeners
 */
export function registerSearchListeners(): void {
	// Search handler
	ipcMain.handle(SEARCH_CHANNELS.SEARCH, async (_event, query: string, limit?: number) => {
		console.log('[Search] Searching for:', query);

		const args = ['search', query, '--json'];
		if (limit) {
			args.push('-n', String(limit));
		}

		const result = await execCli('cortex', args, { timeoutMs: 8000 }); // Reduced timeout to 8s for faster feedback

		if (result.success && result.data) {
			return result.data;
		}

		// Fallback: return empty results
		console.error('[Search] CLI error:', result.error);
		return {
			query,
			results: [],
			count: 0,
			error: result.error,
		};
	});

	// Embed sync handler
	ipcMain.handle(SEARCH_CHANNELS.EMBED_SYNC, async (_event, force?: boolean) => {
		console.log('[Search] Starting embed sync, force:', force);

		const args = ['embed', '--json'];
		if (force) {
			args.push('--force');
		}

		const result = await execCli('cortex', args, { timeoutMs: 60000 });

		if (result.success && result.data) {
			const data = result.data as { success: boolean; exportedCount?: number };
			return {
				success: data.success,
				exportedCount: data.exportedCount,
				timestamp: Date.now(),
			};
		}

		console.error('[Search] Embed sync error:', result.error);
		return {
			success: false,
			error: result.error,
		};
	});
}
