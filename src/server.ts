import type { ServerOptions } from "@modelcontextprotocol/sdk/server/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TimetableApi } from "./api/timetableApi.js";
import { registerTimetableResources } from "./resources/index.js";
import { SERVER_INFO } from "./serverInfo.js";
import { registerTimetableTools } from "./tools/index.js";

const INSTRUCTIONS =
	"Nutze getStationBoard für eine korrekte Bahnhofstafel. In Ereignissen sind effective.time, effective.platform und effective.path die anzuzeigenden Werte. planned enthält den Sollzustand, changed ausschließlich gemeldete Abweichungen. getCurrentTimetable ist der vollständige Änderungsbestand und keine eigenständige Bahnhofstafel.";

export interface CreateServerOptions {
	/** Name und Version, die Clients gemeldet bekommen. */
	serverInfo?: { name: string; version: string };
	/**
	 * JSON-Schema-Validator des SDK. Edge-Runtimes ohne `new Function`
	 * übergeben hier `new CfWorkerJsonSchemaValidator()`; Node nutzt den
	 * SDK-Standard (ajv).
	 */
	jsonSchemaValidator?: ServerOptions["jsonSchemaValidator"];
}

/**
 * Baut den MCP-Server um einen beliebigen `TimetableApi`-Client.
 *
 * Ohne Node- und Umgebungsabhängigkeiten: der npm-Einstieg (src/env.ts) und
 * der Cloudflare Worker (worker/src/mcp.ts) teilen sich diese Funktion.
 */
export function createServer(
	api: TimetableApi,
	options: CreateServerOptions = {},
): McpServer {
	const server = new McpServer(options.serverInfo ?? SERVER_INFO, {
		instructions: INSTRUCTIONS,
		jsonSchemaValidator: options.jsonSchemaValidator,
	});
	registerTimetableTools(server, api);
	registerTimetableResources(server, api);
	return server;
}
