import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createServer } from "../server.js";

const timetableResult = {
	source: "Deutsche Bahn Timetables API" as const,
	retrievedAt: "2026-07-17T08:00:00.000Z",
	endpoint: "/plan/8000105/260717/10 + /fchg/8000105",
	data: {
		station: { evaNo: "8000105", name: "Frankfurt(Main)Hbf" },
		stops: [],
	},
};

const stationResult = {
	source: "Deutsche Bahn Timetables API" as const,
	retrievedAt: "2026-07-17T08:00:00.000Z",
	endpoint: "/station/Frankfurt",
	data: [
		{
			evaNo: "8000105",
			ds100: "FF",
			name: "Frankfurt(Main)Hbf",
			platforms: ["1"],
			metaStations: [],
		},
	],
};

describe("MCP-Serververtrag", () => {
	const api = {
		getStationBoard: vi.fn().mockResolvedValue(timetableResult),
		getCurrentTimetable: vi.fn().mockResolvedValue(timetableResult),
		getRecentChanges: vi.fn().mockResolvedValue(timetableResult),
		getPlannedTimetable: vi.fn().mockResolvedValue(timetableResult),
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
			"getCurrentTimetable",
			"getRecentChanges",
			"getPlannedTimetable",
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

	test("liefert strukturierte Tool-Ausgaben", async () => {
		const result = await client.callTool({
			name: "getStationBoard",
			arguments: { evaNo: "8000105", date: "260717", hour: "10" },
		});

		expect(result.isError).not.toBe(true);
		expect(result.structuredContent).toEqual(timetableResult);
		expect(api.getStationBoard).toHaveBeenCalledWith({
			evaNo: "8000105",
			date: "260717",
			hour: "10",
			includeRawXml: false,
		});
	});

	test.each([
		{
			name: "getCurrentTimetable",
			arguments: { evaNo: "8000105" },
			method: "getCurrentTimetable" as const,
		},
		{
			name: "getRecentChanges",
			arguments: { evaNo: "8000105" },
			method: "getRecentChanges" as const,
		},
		{
			name: "getPlannedTimetable",
			arguments: { evaNo: "8000105", date: "260717", hour: "10" },
			method: "getPlannedTimetable" as const,
		},
		{
			name: "findStations",
			arguments: { pattern: "Frankfurt" },
			method: "findStations" as const,
		},
	])("führt $name über seinen registrierten Handler aus", async (entry) => {
		const result = await client.callTool({
			name: entry.name,
			arguments: entry.arguments,
		});

		expect(result.isError).not.toBe(true);
		expect(api[entry.method]).toHaveBeenCalledOnce();
	});

	test("weist ungültige EVA-Nummern über das MCP-Schema zurück", async () => {
		const result = await client.callTool({
			name: "getCurrentTimetable",
			arguments: { evaNo: "Frankfurt" },
		});

		expect(result.isError).toBe(true);
		expect(api.getCurrentTimetable).not.toHaveBeenCalled();
	});

	test("weist unmögliche Kalendertage über das MCP-Schema zurück", async () => {
		const result = await client.callTool({
			name: "getPlannedTimetable",
			arguments: { evaNo: "8000105", date: "260231", hour: "10" },
		});

		expect(result.isError).toBe(true);
		expect(api.getPlannedTimetable).not.toHaveBeenCalled();
	});

	test("stellt dynamische JSON-Ressourcen bereit", async () => {
		const templates = await client.listResourceTemplates();
		expect(
			templates.resourceTemplates.map((item) => item.uriTemplate),
		).toContain("db-api:station/{pattern}");

		const result = await client.readResource({
			uri: "db-api:station/Frankfurt",
		});
		const content = result.contents[0];
		expect(content.mimeType).toBe("application/json");
		expect("text" in content && JSON.parse(content.text)).toEqual(
			stationResult,
		);
	});

	test.each([
		"db-api:timetable/current/8000105",
		"db-api:timetable/changes/8000105",
		"db-api:timetable/planned/8000105/260717/10",
	])("lädt die Ressource %s über ihren API-Handler", async (uri) => {
		const result = await client.readResource({ uri });
		const content = result.contents[0];

		expect(content.mimeType).toBe("application/json");
		expect("text" in content && JSON.parse(content.text)).toMatchObject({
			source: "Deutsche Bahn Timetables API",
		});
	});

	test("erklärt dem Modell die Semantik von effective, planned und changed", async () => {
		const result = await client.readResource({
			uri: "db-timetable://docs/data-model",
		});
		const content = result.contents[0];
		const schema = "text" in content ? JSON.parse(content.text) : {};

		expect(schema.event.effective).toContain("verwenden");
		expect(schema.event.planned).toContain("Soll");
		expect(schema.event.changed).toContain("Änderung");
	});
});
