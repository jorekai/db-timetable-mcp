import type { Server as HttpServer } from "node:http";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { NextFunction, Request, Response } from "express";
import type { TimetableApi } from "./api/timetableApi.js";
import type { Config } from "./config.js";
import { config, timetableApi } from "./env.js";
import { createServer } from "./server.js";
import { logger } from "./utils/logger.js";

type ServerConfig = Config["server"];

const methodNotAllowed = {
	jsonrpc: "2.0",
	error: { code: -32_000, message: "Method not allowed" },
	id: null,
};

interface HttpRequestError extends Error {
	status?: number;
	type?: string;
}

/**
 * Beantwortet Fehler aus der Body-Verarbeitung als JSON-RPC.
 *
 * Der Standard-Handler von Express protokolliert das ganze Fehlerobjekt, und
 * das enthält bei ungültigem JSON den Anfrage-Body. Hier landen nur Status und
 * Fehlerart im Log.
 */
function handleRequestError(
	error: HttpRequestError,
	_request: Request,
	response: Response,
	next: NextFunction
) {
	const status = error.status ?? 500;

	logger.warn("HTTP-Anfrage abgelehnt", { status, type: error.type ?? error.name });

	if (response.headersSent) {
		next(new Error("Antwort bereits begonnen"));

		return;
	}

	response.status(status).json({
		jsonrpc: "2.0",
		error: requestErrorBody(status, error.type),
		id: null,
	});
}

function requestErrorBody(status: number, type?: string) {
	if (type === "entity.parse.failed") {
		return { code: -32_700, message: "Parse error" };
	}

	if (status >= 400 && status < 500) {
		return { code: -32_600, message: "Invalid Request" };
	}

	return { code: -32_603, message: "Internal server error" };
}

export function createHttpApp(
	api: TimetableApi = timetableApi,
	serverConfig: ServerConfig = config.server
) {
	const app = createMcpExpressApp({
		host: serverConfig.host,
		allowedHosts: serverConfig.allowedHosts,
	});

	app.get("/health", (_request: Request, response: Response) => {
		response.json({
			status: "ok",
			server: serverConfig.name,
			version: serverConfig.version,
			transport: "streamable-http",
		});
	});

	app.post(serverConfig.endpoint, async (request: Request, response: Response) => {
		const server = createServer(api);

		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true,
		});

		response.once("finish", () => {
			void Promise.all([transport.close(), server.close()]);
		});

		try {
			await server.connect(transport);
			await transport.handleRequest(request, response, request.body);
		} catch (error) {
			logger.error("Streamable-HTTP-Anfrage fehlgeschlagen", { error });

			if (!response.headersSent) {
				response.status(500).json({
					jsonrpc: "2.0",
					error: { code: -32_603, message: "Internal server error" },
					id: null,
				});
			}
		}
	});

	app.get(serverConfig.endpoint, (_request: Request, response: Response) => {
		response.status(405).json(methodNotAllowed);
	});
	app.delete(serverConfig.endpoint, (_request: Request, response: Response) => {
		response.status(405).json(methodNotAllowed);
	});
	app.use(handleRequestError);

	return app;
}

export async function startHttpServer(
	api: TimetableApi = timetableApi,
	serverConfig: ServerConfig = config.server
): Promise<HttpServer> {
	const app = createHttpApp(api, serverConfig);

	return await new Promise((resolve, reject) => {
		const httpServer = app.listen(serverConfig.port, serverConfig.host, () => {
			logger.info("MCP-Server lauscht über Streamable HTTP", {
				host: serverConfig.host,
				port: serverConfig.port,
				endpoint: serverConfig.endpoint,
			});
			resolve(httpServer);
		});

		httpServer.once("error", reject);
	});
}

export async function startStdioServer(api: TimetableApi = timetableApi) {
	const server = createServer(api);
	await server.connect(new StdioServerTransport());
	logger.info("MCP-Server lauscht über stdio");

	return server;
}
