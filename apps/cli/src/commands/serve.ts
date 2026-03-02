import { Command, Flags } from "@oclif/core";
import { spawn } from "child_process";
import path from "path";

export default class Serve extends Command {
	static description = "Start the Backpack API + MCP server";

	static flags = {
		port: Flags.integer({ char: "p", description: "Port to listen on", default: 3000 }),
		host: Flags.string({ char: "h", description: "Host to bind to", default: "127.0.0.1" }),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Serve);

		this.log(`Starting Backpack server on ${flags.host}:${flags.port}...`);

		const serverEntry = path.resolve(__dirname, "../../../server/src/index.ts");

		const child = spawn("bun", ["run", serverEntry], {
			env: {
				...process.env,
				PORT: String(flags.port),
				HOST: flags.host,
			},
			stdio: "inherit",
		});

		child.on("error", (error) => {
			this.error(`Failed to start server: ${error.message}`);
		});

		child.on("exit", (code) => {
			if (code !== 0) {
				this.error(`Server exited with code ${code}`);
			}
		});

		// Keep the CLI alive while the server runs
		await new Promise<void>((resolve) => {
			process.on("SIGINT", () => {
				child.kill("SIGINT");
				resolve();
			});
			process.on("SIGTERM", () => {
				child.kill("SIGTERM");
				resolve();
			});
		});
	}
}
