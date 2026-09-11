import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, test, vi } from "vitest";
import { UpstreamLog } from "../../../worker/src/cache.js";
import type { Env } from "../../../worker/src/env.js";
import { createWorkerServer } from "../../../worker/src/mcp.js";
import type { TimetableApi } from "../../api/timetableApi.js";
import { createServer } from "../../server.js";

/**
 * API-Vertrag: Werkzeug- und Ressourcenbeschreibung des Workers müssen
 * byte-identisch zur npm-Variante sein. Beide bauen auf `createServer(api)`
 * auf — dieser Test hält das fest.
 */

const WORKER_ENV: Env = {
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

async function listFrom(server: ReturnType<typeof createServer>) {
	const client = new Client({ name: "contract-test", version: "1.0.0" });
	const [clientTransport, serverTransport] =
		InMemoryTransport.createLinkedPair();

	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);

	const tools = await client.listTools();
	const resources = await client.listResourceTemplates();
	const info = client.getServerVersion();
	await client.close();
	await server.close();

	return { tools, resources, info };
}

describe("Worker-MCP-Vertrag", () => {
	test("tools/list ist byte-identisch zum npm-Server", async () => {
		const npm = await listFrom(createServer(stubApi()));
		const worker = await listFrom(
			createWorkerServer(WORKER_ENV, new UpstreamLog(), "https://worker.test"),
		);

		expect(JSON.stringify(worker.tools)).toBe(JSON.stringify(npm.tools));
	});

	test("resources/templates/list ist byte-identisch zum npm-Server", async () => {
		const npm = await listFrom(createServer(stubApi()));
		const worker = await listFrom(
			createWorkerServer(WORKER_ENV, new UpstreamLog(), "https://worker.test"),
		);

		expect(JSON.stringify(worker.resources)).toBe(
			JSON.stringify(npm.resources),
		);
	});

	test("meldet dieselbe Serveridentität wie der npm-Server", async () => {
		const npm = await listFrom(createServer(stubApi()));
		const worker = await listFrom(
			createWorkerServer(WORKER_ENV, new UpstreamLog(), "https://worker.test"),
		);

		expect(worker.info).toEqual(npm.info);
		expect(worker.info?.name).toBe("DB Timetable MCP Server");
		expect(worker.info?.version).toBe("2.0.0");
	});

	test("der Worker-Server nutzt den CfWorker-Validator (kein new Function)", async () => {
		// Rauchtest: der Server muss sich ohne ajv konstruieren und verbinden
		// lassen. Würde ein `new Function`-Validator geladen, schlüge das im
		// Worker fehl — hier belegt es zumindest die Verdrahtung.
		const worker = createWorkerServer(
			WORKER_ENV,
			new UpstreamLog(),
			"https://worker.test",
		);

		expect(worker.isConnected()).toBe(false);
		await worker.close();
	});
});
