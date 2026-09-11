/**
 * Identität, die der MCP-Server seinen Clients meldet.
 *
 * Frei von Node- und Umgebungsabhängigkeiten, damit npm-Server (src/env.ts)
 * und Cloudflare Worker (worker/src/mcp.ts) dieselbe Identität verwenden.
 */
export const SERVER_INFO = {
	name: "DB Timetable MCP Server",
	version: "2.0.0",
} as const;
