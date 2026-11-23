import type { ServerOptions } from "@modelcontextprotocol/sdk/server/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TimetableApi } from "./api/timetableApi.js";
import { registerTimetableResources } from "./resources/index.js";
import { SERVER_INFO } from "./serverInfo.js";
import { registerTimetableTools } from "./tools/index.js";

const INSTRUCTIONS =
	"Ermittle die EVA-Nummer mit findStations und rufe dann getDepartures, getArrivals oder für beide Richtungen getStationBoard auf. In Ereignissen sind effective.time und effective.platform die anzuzeigenden Werte, planned enthält den Sollzustand. via ist nur eine Auswahl der Unterwegshalte. Ist truncatedTransportTypes nicht leer, fehlen Einträge.";

/**
 * Obergrenze für Array-Elemente und Objekt-Schlüssel in den Argumenten eines
 * `tools/call`. Die Werkzeuge nehmen nur wenige skalare Felder entgegen; die
 * Grenze hält die Schema-Validierung bei übergroßen Eingaben billig.
 */
export const MAX_TOOL_INPUT_ELEMENTS = 1_000;

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
export function createServer(api: TimetableApi, options: CreateServerOptions = {}): McpServer {
	const server = new McpServer(options.serverInfo ?? SERVER_INFO, {
		instructions: INSTRUCTIONS,
		maxToolInputElements: MAX_TOOL_INPUT_ELEMENTS,
		jsonSchemaValidator: options.jsonSchemaValidator,
	});

	registerTimetableTools(server, api);
	registerTimetableResources(server, api);

	return server;
}
