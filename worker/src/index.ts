import { SERVER_INFO } from "../../src/serverInfo.js";
import { type Env, HEALTH_PATH, MCP_PATH, META_HEADERS } from "./env.js";
import { handleMcpRequest } from "./mcp.js";
import { checkRateLimit } from "./ratelimit.js";

/**
 * HTTP-Fassade des Workers: CORS, Rate Limit, Routing.
 *
 * CORS ist eng gefasst: `Access-Control-Allow-Origin` wird nur für Origins aus
 * ALLOWED_ORIGINS gesetzt, nie auf `*`.
 */

/** Header, die MCP-Clients im Browser benötigen. */
const ALLOWED_REQUEST_HEADERS = [
	"Content-Type",
	"Mcp-Session-Id",
	"Mcp-Protocol-Version",
	"Authorization",
	"Last-Event-ID",
	"Accept",
	"X-Simulate-Upstream-Error",
];

/** Header, die das Frontend auslesen darf. */
const EXPOSED_RESPONSE_HEADERS = [
	"Mcp-Session-Id",
	...Object.values(META_HEADERS),
];

function allowedOrigins(env: Env): string[] {
	return (env.ALLOWED_ORIGINS ?? "")
		.split(",")
		.map((origin) => origin.trim())
		.filter((origin) => origin.length > 0);
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
	const headers: Record<string, string> = {
		Vary: "Origin",
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Allow-Headers": ALLOWED_REQUEST_HEADERS.join(", "),
		"Access-Control-Expose-Headers": EXPOSED_RESPONSE_HEADERS.join(", "),
		"Access-Control-Max-Age": "86400",
	};

	if (origin && allowedOrigins(env).includes(origin)) {
		headers["Access-Control-Allow-Origin"] = origin;
	}

	return headers;
}

function jsonResponse(
	body: unknown,
	status: number,
	cors: Record<string, string>,
	extra: Record<string, string> = {},
): Response {
	return new Response(JSON.stringify(body, null, 2), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			...cors,
			...extra,
		},
	});
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get("Origin");
		const cors = corsHeaders(origin, env);

		// Preflight. Ohne das funktioniert curl und der Browser scheitert.
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: cors });
		}

		if (url.pathname === HEALTH_PATH) {
			return jsonResponse(
				{ ok: true, name: SERVER_INFO.name, version: SERVER_INFO.version },
				200,
				cors,
			);
		}

		if (url.pathname !== MCP_PATH) {
			return jsonResponse(
				{
					error: {
						code: "NOT_FOUND",
						message: `The MCP endpoint is ${MCP_PATH}.`,
					},
				},
				404,
				cors,
			);
		}

		if (!env.DB_TIMETABLE_CLIENT_ID || !env.DB_TIMETABLE_CLIENT_SECRET) {
			return jsonResponse(
				{
					error: {
						code: "CONFIGURATION_MISSING",
						message:
							"Credentials are missing. Set DB_TIMETABLE_CLIENT_ID and DB_TIMETABLE_CLIENT_SECRET as worker secrets.",
					},
				},
				500,
				cors,
			);
		}

		const clientKey = request.headers.get("CF-Connecting-IP");
		if (clientKey) {
			const limit = checkRateLimit(clientKey);
			if (!limit.allowed) {
				return jsonResponse(
					{
						error: {
							code: "RATE_LIMITED",
							message: `Too many requests (${limit.limit} per ${limit.window} from this address).`,
						},
					},
					429,
					cors,
					{
						"Retry-After": String(limit.retryAfterSeconds),
						"X-RateLimit-Limit": String(limit.limit),
						"X-RateLimit-Window": limit.window,
					},
				);
			}
		}

		if (request.method !== "POST") {
			// Stateless-Demo: kein SSE-Stream (GET), keine Session (DELETE).
			return jsonResponse(
				{
					error: {
						code: "METHOD_NOT_ALLOWED",
						message: "This demo runs stateless; use POST on /mcp.",
					},
				},
				405,
				cors,
				{ Allow: "POST, OPTIONS" },
			);
		}

		const simulation =
			env.ALLOW_SIMULATION === "1"
				? request.headers.get("X-Simulate-Upstream-Error")
				: null;

		const mcpResponse = await handleMcpRequest(request, env, ctx, simulation);

		const headers = new Headers(mcpResponse.headers);
		for (const [key, value] of Object.entries(cors)) {
			headers.set(key, value);
		}

		return new Response(mcpResponse.body, {
			status: mcpResponse.status,
			headers,
		});
	},
};
