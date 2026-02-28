import { tool } from "ai";
import { z } from "zod";
import { Sandbox } from "./sandbox";

const sandbox = new Sandbox();

export const searchTool = tool({
	description:
		"Search the Backpack SDK spec for available methods. Write JavaScript code that filters backpackSpec to find relevant methods.",
	inputSchema: z.object({
		code: z
			.string()
			.describe(
				"JavaScript async arrow function that searches backpackSpec, e.g., async () => { const results = []; for (const [name, method] of Object.entries(backpackSpec)) { if (name.includes('timeline')) results.push({ name, ...method }); } return results; }"
			),
	}),
	execute: async ({ code }) => {
		const result = await sandbox.run(code);
		if (!result.success) {
			return { error: result.error, logs: result.logs };
		}
		return { result: result.result, logs: result.logs };
	},
});

export const executeTool = tool({
	description:
		"Execute JavaScript code that calls Backpack SDK methods. Write code to query data, search, sync, etc.",
	inputSchema: z.object({
		code: z
			.string()
			.describe(
				"JavaScript async arrow function that calls backpack methods, e.g., async () => { const timeline = await backpack.timeline({ limit: 10 }); return timeline.items; }"
			),
	}),
	execute: async ({ code }) => {
		const result = await sandbox.run(code);
		if (!result.success) {
			return { error: result.error, logs: result.logs };
		}
		return { result: result.result, logs: result.logs };
	},
});
