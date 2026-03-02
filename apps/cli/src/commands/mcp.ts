import { Command, Flags } from "@oclif/core";

export default class Mcp extends Command {
	static description = "Show MCP server info and status";

	static flags = {
		json: Flags.boolean({ char: "j", description: "Output as JSON" }),
		port: Flags.integer({ char: "p", description: "Server port", default: 3000 }),
	};

	async run(): Promise<void> {
		const { flags } = await this.parse(Mcp);
		const baseUrl = `http://127.0.0.1:${flags.port}`;

		try {
			const response = await fetch(`${baseUrl}/mcp/health`);
			if (!response.ok) {
				this.error(`MCP server returned ${response.status}`);
			}

			const data = await response.json() as {
				status: string;
				server: string;
				version: string;
				tools: string[];
				endpoint: string;
			};

			if (flags.json) {
				this.log(JSON.stringify({ ...data, url: baseUrl }, null, 2));
				return;
			}

			this.log("MCP Server Status");
			this.log("─".repeat(40));
			this.log(`  Status:    ${data.status}`);
			this.log(`  Server:    ${data.server} v${data.version}`);
			this.log(`  Endpoint:  ${baseUrl}${data.endpoint}`);
			this.log(`  Tools:     ${data.tools.join(", ")}`);
		} catch (error: any) {
			if (error.code === "ECONNREFUSED" || error.message?.includes("ECONNREFUSED")) {
				this.log("MCP server is not running.");
				this.log(`Start it with: backpack serve --port ${flags.port}`);
			} else {
				this.error(`Failed to connect to MCP server: ${error.message}`);
			}
		}
	}
}
