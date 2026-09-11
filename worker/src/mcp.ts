import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker";
import { TimetableApiClient } from "../../src/api/timetableApi.js";
import { createServer } from "../../src/server.js";
import { createCachedFetch, UpstreamLog } from "./cache.js";
import {
	API_BASE_URL,
	type Env,
	META_HEADERS,
	UPSTREAM_TIMEOUT_MS,
} from "./env.js";

/**
 * MCP über Streamable HTTP im Worker.
 *
 * Der Server selbst kommt unverändert aus `createServer(api)` — Werkzeuge,
 * Ressourcen, Beschreibungen und Schemata sind identisch zum npm-Server.
 * Der Worker liefert nur den Client (Worker-Bindings statt `.env`) und den
 * Validator (ohne `new Function`) dazu.
 */

export function createWorkerServer(
	env: Env,
	log: UpstreamLog,
	cacheOrigin: string,
	ctx?: ExecutionContext,
	simulation: string | null = null,
) {
	const api = new TimetableApiClient(
		{
			baseUrl: API_BASE_URL,
			clientId: env.DB_TIMETABLE_CLIENT_ID,
			clientSecret: env.DB_TIMETABLE_CLIENT_SECRET,
			timeoutMs: UPSTREAM_TIMEOUT_MS,
		},
		createCachedFetch(cacheOrigin, log, ctx, simulation),
	);

	return createServer(api, {
		// ajv nutzt `new Function`, was Cloudflare Workers blockieren.
		jsonSchemaValidator: new CfWorkerJsonSchemaValidator({ draft: "7" }),
	});
}

/**
 * Stateless Streamable HTTP: pro Request ein eigener Server und Transport.
 * `sessionIdGenerator: undefined` unterdrückt die `Mcp-Session-Id`; jeder
 * Aufruf ist damit unabhängig und übersteht Kaltstarts.
 */
export async function handleMcpRequest(
	request: Request,
	env: Env,
	ctx?: ExecutionContext,
	simulation: string | null = null,
): Promise<Response> {
	const log = new UpstreamLog();
	const server = createWorkerServer(
		env,
		log,
		new URL(request.url).origin,
		ctx,
		simulation,
	);

	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		// JSON statt SSE: der Browser ruft mit fetch auf und braucht keinen Stream.
		enableJsonResponse: true,
	});

	await server.connect(transport);
	const response = await transport.handleRequest(request);

	// Cache-Zustand additiv als HTTP-Header. Der MCP-Tool-Vertrag bleibt
	// unverändert; das Frontend zeigt damit Herkunft und Alter der Daten.
	const headers = new Headers(response.headers);
	headers.set(META_HEADERS.upstreamCalls, String(log.upstreamCalls));
	if (log.calls.length > 0) {
		headers.set(META_HEADERS.cache, log.fromCache ? "hit" : "miss");
		if (log.stale) headers.set(META_HEADERS.stale, "true");
		if (log.retrievedAt) headers.set(META_HEADERS.retrievedAt, log.retrievedAt);
	}

	return new Response(response.body, {
		status: response.status,
		headers,
	});
}
