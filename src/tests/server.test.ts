import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createServer } from "../server.js";
import { ApiError } from "../utils/errorHandling.js";

const boardResult = {
	source: "Deutsche Bahn OpenBoards API" as const,
	retrievedAt: "2026-07-17T08:00:00.000Z",
	endpoint: "/departures",
	data: {
		station: { evaNo: "8000105", name: "Frankfurt (Main) Hbf" },
		stops: [],
	},
};

const stationResult = {
	source: "DB InfraGO OpenStation (NeTEx)" as const,
	retrievedAt: "2026-07-17T08:00:00.000Z",
	dataAsOf: "2026-07-01T00:00:00.000Z",
	endpoint: "stations/stationIndex",
	data: { totalMatches: 0, stations: [] },
};

describe("MCP-Serververtrag", () => {
	const api = {
		getStationBoard: vi.fn().mockResolvedValue(boardResult),
		getDepartures: vi.fn().mockResolvedValue(boardResult),
		getArrivals: vi.fn().mockResolvedValue(boardResult),
		findStations: vi.fn().mockResolvedValue(stationResult),
	};
	let client: Client;
	let server: ReturnType<typeof createServer>;

	beforeEach(async () => {
		vi.clearAllMocks();
		client = new Client({ name: "test-client", version: "1.0.0" });
		server = createServer(api);
		const [clientTransport, serverTransport] =
			InMemoryTransport.createLinkedPair();
		await Promise.all([
			server.connect(serverTransport),
			client.connect(clientTransport),
		]);
	});

	afterEach(async () => {
		await Promise.all([client.close(), server.close()]);
	});

	test("publiziert fokussierte Tools mit vollständigen Schemas", async () => {
		const { tools } = await client.listTools();

		expect(tools.map((tool) => tool.name)).toEqual([
			"getStationBoard",
			"getDepartures",
			"getArrivals",
			"findStations",
		]);
		for (const tool of tools) {
			expect(tool.description?.length).toBeGreaterThan(80);
			expect(tool.inputSchema.type).toBe("object");
			expect(tool.outputSchema?.type).toBe("object");
			expect(tool.annotations).toMatchObject({
				readOnlyHint: true,
				destructiveHint: false,
				idempotentHint: true,
			});
		}
	});

	test("liefert strukturierte Tool-Ausgaben und setzt Vorgaben", async () => {
		const result = await client.callTool({
			name: "getStationBoard",
			arguments: { evaNo: "8000105" },
		});

		expect(result.isError).not.toBe(true);
		expect(result.structuredContent).toEqual(boardResult);
		expect(api.getStationBoard).toHaveBeenCalledWith({
			evaNo: "8000105",
			durationMinutes: 60,
			includeNearbyStops: true,
			maxEntriesPerTransportType: 50,
		});
	});

	test.each(["getDepartures" as const, "getArrivals" as const])(
		"führt %s mit allen Filtern aus",
		async (name) => {
			const args = {
				evaNo: "8000105",
				startTime: "2026-07-17T10:00",
				durationMinutes: 480,
				platforms: ["7"],
				transportTypes: ["CITY_TRAIN"],
				includeNearbyStops: false,
				maxEntriesPerTransportType: 1,
			};
			const result = await client.callTool({ name, arguments: args });

			expect(result.isError).not.toBe(true);
			expect(api[name]).toHaveBeenCalledWith(args);
		},
	);

	test("führt findStations mit Standardlimit aus", async () => {
		const result = await client.callTool({
			name: "findStations",
			arguments: { pattern: " Frankfurt " },
		});

		expect(result.structuredContent).toEqual(stationResult);
		expect(api.findStations).toHaveBeenCalledWith({
			pattern: "Frankfurt",
			limit: 20,
		});
	});

	test.each([
		{ evaNo: "Frankfurt" },
		{ evaNo: "8000105", startTime: "2026-02-31T10:00" },
		{ evaNo: "8000105", durationMinutes: 481 },
		{ evaNo: "8000105", transportTypes: ["BUS"] },
		{ evaNo: "8000105", maxEntriesPerTransportType: 51 },
	])(
		"weist ungültige Eingaben über das MCP-Schema zurück: %o",
		async (args) => {
			const result = await client.callTool({
				name: "getDepartures",
				arguments: args,
			});

			expect(result.isError).toBe(true);
			expect(api.getDepartures).not.toHaveBeenCalled();
		},
	);

	test("meldet fachliche Fehler mit Code und verbirgt unerwartete", async () => {
		api.getDepartures.mockRejectedValueOnce(
			new ApiError("zu viele Anfragen", "API_RATE_LIMIT", 429),
		);
		api.getArrivals.mockRejectedValueOnce(new Error("intern"));
		const read = async (name: string) => {
			const result = await client.callTool({
				name,
				arguments: { evaNo: "8000105" },
			});
			expect(result.isError).toBe(true);
			return (result.content as { text: string }[])[0].text;
		};

		expect(JSON.parse(await read("getDepartures")).error).toEqual({
			code: "API_RATE_LIMIT",
			message: "zu viele Anfragen",
		});
		expect(await read("getArrivals")).not.toContain("intern");
	});

	test("stellt dynamische JSON-Ressourcen bereit", async () => {
		const templates = await client.listResourceTemplates();
		expect(templates.resourceTemplates.map((item) => item.uriTemplate)).toEqual(
			[
				"db-api:board/{evaNo}",
				"db-api:departures/{evaNo}",
				"db-api:arrivals/{evaNo}",
				"db-api:station/{pattern}",
			],
		);

		const result = await client.readResource({
			uri: "db-api:station/K%C3%B6ln%20Hbf",
		});
		const content = result.contents[0];
		expect(content.mimeType).toBe("application/json");
		expect("text" in content && JSON.parse(content.text)).toEqual(
			stationResult,
		);
		expect(api.findStations).toHaveBeenCalledWith({ pattern: "Köln Hbf" });
	});

	test("weist fehlerhaft kodierte Ressourcen-URIs zurück", async () => {
		await expect(
			client.readResource({ uri: "db-api:station/%zz" }),
		).rejects.toThrow("fehlerhaft kodiert");
		expect(api.findStations).not.toHaveBeenCalled();
	});

	test.each([
		["db-api:board/8000105", "getStationBoard" as const],
		["db-api:departures/8000105", "getDepartures" as const],
		["db-api:arrivals/8000105", "getArrivals" as const],
	])("lädt die Ressource %s über %s", async (uri, method) => {
		const result = await client.readResource({ uri });
		const content = result.contents[0];

		expect("text" in content && JSON.parse(content.text)).toEqual(boardResult);
		expect(api[method]).toHaveBeenCalledWith({ evaNo: "8000105" });
	});

	test("erklärt dem Modell die Semantik des Datenmodells", async () => {
		const result = await client.readResource({
			uri: "db-timetable://docs/data-model",
		});
		const content = result.contents[0];
		const schema = "text" in content ? JSON.parse(content.text) : {};

		expect(schema.event.effective).toContain("verwenden");
		expect(schema.event.planned).toContain("Soll");
		expect(schema.event.via).toContain("Nicht vollständig");
	});
});
