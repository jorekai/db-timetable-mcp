import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type TimetableApi, timetableApi } from "./api/timetableApi.js";
import { config } from "./config.js";
import { registerTimetableResources } from "./resources/index.js";
import { registerTimetableTools } from "./tools/index.js";

const INSTRUCTIONS =
	"Nutze getStationBoard für eine korrekte Bahnhofstafel. In Ereignissen sind effective.time, effective.platform und effective.path die anzuzeigenden Werte. planned enthält den Sollzustand, changed ausschließlich gemeldete Abweichungen. getCurrentTimetable ist der vollständige Änderungsbestand und keine eigenständige Bahnhofstafel.";

export function createServer(api: TimetableApi = timetableApi): McpServer {
	const server = new McpServer(
		{ name: config.server.name, version: config.server.version },
		{ instructions: INSTRUCTIONS },
	);
	registerTimetableTools(server, api);
	registerTimetableResources(server, api);
	return server;
}
