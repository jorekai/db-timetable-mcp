import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createHttpApp, startHttpServer } from "../transport.js";

describe("Streamable-HTTP-Transport", () => {
	const api = {
		getStationBoard: vi.fn(),
		getDepartures: vi.fn(),
		getArrivals: vi.fn(),
		findStations: vi.fn(),
	};

	const app = createHttpApp(api, {
		name: "DB Timetable MCP Server",
		version: "3.0.0",
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
			httpServer.close((error?: Error) => (error ? reject(error) : resolve()))
		);
	});

	test("liefert einen maschinenlesbaren Healthcheck", async () => {
		const response = await fetch(`${baseUrl}/health`);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			status: "ok",
			server: "DB Timetable MCP Server",
			version: "3.0.0",
			transport: "streamable-http",
		});
	});

	test("spricht den aktuellen stateless Streamable-HTTP-Vertrag", async () => {
		const client = new Client({ name: "http-test", version: "1.0.0" });

		const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));

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

	test.each([
		["ungültiges JSON", '{"geheim":"SENTINEL', "application/json", 400, -32_700],
		["zu großer Body", `"SENTINEL${"a".repeat(200_000)}"`, "application/json", 413, -32_600],
		["unbekannter Zeichensatz", '"SENTINEL"', "application/json; charset=x-foo", 415, -32_600],
	])(
		"lehnt %s ab, ohne den Body zu protokollieren",
		async (_name, body, contentType, status, code) => {
			const spies = [
				vi.spyOn(console, "error").mockImplementation(() => undefined),
				vi.spyOn(process.stderr, "write").mockImplementation(() => true),
			];

			const response = await fetch(`${baseUrl}/mcp`, {
				method: "POST",
				headers: { "Content-Type": contentType },
				body,
			});

			const output = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));

			for (const spy of spies) {
				spy.mockRestore();
			}

			const payload = await response.text();

			expect(response.status).toBe(status);
			expect(JSON.parse(payload)).toMatchObject({ jsonrpc: "2.0", error: { code }, id: null });
			expect(payload).not.toContain("SENTINEL");
			expect(output).toContain("HTTP-Anfrage abgelehnt");
			expect(output).not.toContain("SENTINEL");
		}
	);

	test("startet den konfigurierten HTTP-Listener auf einem freien Port", async () => {
		const server = await startHttpServer(api, {
			name: "DB Timetable MCP Server",
			version: "3.0.0",
			transport: "http",
			host: "127.0.0.1",
			port: 0,
			endpoint: "/mcp",
		});

		const address = server.address() as AddressInfo;

		expect(address.port).toBeGreaterThan(0);
		await new Promise<void>((resolve, reject) =>
			server.close((error?: Error) => (error ? reject(error) : resolve()))
		);
	});
});
