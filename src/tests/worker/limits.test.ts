import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, test, vi } from "vitest";
import type { Env } from "../../../worker/src/env.js";
import {
	handleMcpRequest,
	MAX_REQUEST_BODY_BYTES,
} from "../../../worker/src/mcp.js";
import type { TimetableApi } from "../../api/timetableApi.js";
import { createServer, MAX_TOOL_INPUT_ELEMENTS } from "../../server.js";

/**
 * Eingangsgrenzen: übergroße Bodies und Argumente werden abgewiesen, bevor
 * Validierung oder Upstream-Aufrufe Arbeit verursachen.
 */

const ENV: Env = {
	DB_TIMETABLE_CLIENT_ID: "test-client",
	DB_TIMETABLE_CLIENT_SECRET: "test-secret",
	ALLOWED_ORIGINS: "https://jorekai.github.io",
	ENVIRONMENT: "test",
};

function stubApi(): TimetableApi {
	return {
		getStationBoard: vi.fn(),
		getCurrentTimetable: vi.fn(),
		getRecentChanges: vi.fn(),
		getPlannedTimetable: vi.fn(),
		findStations: vi.fn(),
	};
}

describe("Eingangsgrenzen", () => {
	test("ein Body über der Grenze wird mit 413 abgewiesen", async () => {
		const body = JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "ping",
			params: { padding: "x".repeat(MAX_REQUEST_BODY_BYTES) },
		});
		const response = await handleMcpRequest(
			new Request("https://worker.test/mcp", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
				},
				body,
			}),
			ENV,
		);

		expect(response.status).toBe(413);
	});

	test("tools/call mit zu vielen Elementen liefert isError ohne API-Aufruf", async () => {
		const api = stubApi();
		const server = createServer(api);
		const client = new Client({ name: "limits-test", version: "1.0.0" });
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		await Promise.all([
			server.connect(serverTransport),
			client.connect(clientTransport),
		]);

		const result = await client.callTool({
			name: "findStations",
			arguments: {
				pattern: "Berlin",
				extra: Array.from({ length: MAX_TOOL_INPUT_ELEMENTS + 1 }, () => 0),
			},
		});
		await client.close();
		await server.close();

		expect(result.isError).toBe(true);
		expect(api.findStations).not.toHaveBeenCalled();
	});
});
