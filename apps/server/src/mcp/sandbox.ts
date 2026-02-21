import vm from "node:vm";
import { Cortex, cortexSpec } from "@cortex/sdk";

export interface SandboxResult {
	success: boolean;
	result?: unknown;
	error?: string;
	logs: string[];
}

export class Sandbox {
	private timeout: number;

	constructor(timeout = 30000) {
		this.timeout = timeout;
	}

	async run(code: string): Promise<SandboxResult> {
		const logs: string[] = [];

		const context = vm.createContext({
			cortex: new Cortex(),
			cortexSpec,
			console: {
				log: (...args: unknown[]) =>
					logs.push(args.map((a) => String(a)).join(" ")),
				error: (...args: unknown[]) =>
					logs.push("[ERROR] " + args.map((a) => String(a)).join(" ")),
				warn: (...args: unknown[]) =>
					logs.push("[WARN] " + args.map((a) => String(a)).join(" ")),
			},
		});

		let wrappedCode = code.trim();

		if (!wrappedCode.startsWith("async") && !wrappedCode.startsWith("(")) {
			wrappedCode = `async () => { ${wrappedCode} }`;
		}

		if (!wrappedCode.startsWith("async")) {
			wrappedCode = `(async () => { return await (${wrappedCode})(); })()`;
		} else if (
			!wrappedCode.startsWith("(async") &&
			!wrappedCode.startsWith("async (")
		) {
			const match = wrappedCode.match(/^(async\s+(?:function\s+)?(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*))\s*=>/);
			if (!match) {
				wrappedCode = `(async () => { return await (${wrappedCode})(); })()`;
			}
		} else if (wrappedCode.startsWith("async ()") || wrappedCode.startsWith("async(")) {
			wrappedCode = `(async () => { return await (${wrappedCode})(); })()`;
		}

		try {
			const script = new vm.Script(wrappedCode, {
				filename: "usercode.js",
			});

			const result = script.runInContext(context, {
				timeout: this.timeout,
			});

			let finalResult: unknown;
			const timeoutPromise = new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("Execution timeout")), this.timeout)
			);

			finalResult = await Promise.race([result, timeoutPromise]);

			if (finalResult instanceof Promise) {
				finalResult = await finalResult;
			}

			return { success: true, result: finalResult, logs };
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return { success: false, error: errorMessage, logs };
		}
	}
}
