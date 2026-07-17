import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createHttpApp, startHttpServer } from "../transport.js";

describe("Streamable-HTTP-Transport", () => {
	const api = {
		getStationBoard: vi.fn(),
		getCurrentTimetable: vi.fn(),
		getRecentChanges: vi.fn(),
		getPlannedTimetable: vi.fn(),
		findStations: vi.fn(),
	};
	const app = createHttpApp(api, {
		name: "DB Timetable MCP Server",
		version: "2.0.0",
		transport: "http",
		host: "127.0.0.1",
		port: 0,
		endpoint: "/mcp",
	});
	let httpServer: ReturnType<typeof app.listen>;
	let baseUrl: string;

	beforeEach(async () => {
		httpServer = app.listen(0, "127.0.0.1");
		await new Promise<void>((resolve) => httpServer.once("listening", resolve));
		const address = httpServer.address() as AddressInfo;
		baseUrl = `http://127.0.0.1:${address.port}`;
	});

	afterEach(async () => {
		await new Promise<void>((resolve, reject) =>
			httpServer.close((error?: Error) => (error ? reject(error) : resolve())),
		);
	});

	test("liefert einen maschinenlesbaren Healthcheck", async () => {
		const response = await fetch(`${baseUrl}/health`);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			status: "ok",
			server: "DB Timetable MCP Server",
			version: "2.0.0",
			transport: "streamable-http",
		});
	});

	test("spricht den aktuellen stateless Streamable-HTTP-Vertrag", async () => {
		const client = new Client({ name: "http-test", version: "1.0.0" });
		const transport = new StreamableHTTPClientTransport(
			new URL(`${baseUrl}/mcp`),
		);

		await client.connect(transport);
		const { tools } = await client.listTools();
		await client.close();

		expect(tools.map((tool) => tool.name)).toContain("getStationBoard");
	});

	test("weist alte SSE-GET-Anfragen explizit zurück", async () => {
		const response = await fetch(`${baseUrl}/mcp`);

		expect(response.status).toBe(405);
		expect(await response.json()).toMatchObject({
			jsonrpc: "2.0",
			error: { code: -32000 },
			id: null,
		});
	});

	test("startet den konfigurierten HTTP-Listener auf einem freien Port", async () => {
		const server = await startHttpServer(api, {
			name: "DB Timetable MCP Server",
			version: "2.0.0",
			transport: "http",
			host: "127.0.0.1",
			port: 0,
			endpoint: "/mcp",
		});
		const address = server.address() as AddressInfo;

		expect(address.port).toBeGreaterThan(0);
		await new Promise<void>((resolve, reject) =>
			server.close((error?: Error) => (error ? reject(error) : resolve())),
		);
	});
});
