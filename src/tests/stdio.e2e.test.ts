import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
	getDefaultEnvironment,
	StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, test } from "vitest";

describe("stdio End-to-End", () => {
	test("handelt echtes MCP aus, obwohl der Server Statuslogs schreibt", async () => {
		const transport = new StdioClientTransport({
			command: process.execPath,
			args: ["--import", "tsx", "src/index.ts"],
			cwd: process.cwd(),
			env: {
				...getDefaultEnvironment(),
				MCP_TRANSPORT: "stdio",
				LOG_LEVEL: "info",
			},
			stderr: "pipe",
		});
		let stderr = "";
		transport.stderr?.on("data", (chunk) => {
			stderr += String(chunk);
		});
		const client = new Client({ name: "stdio-e2e", version: "1.0.0" });

		await client.connect(transport);
		const { tools } = await client.listTools();
		await client.close();

		expect(tools.map((tool) => tool.name)).toContain("getStationBoard");
		expect(stderr).toContain("MCP-Server lauscht über stdio");
	});
});
