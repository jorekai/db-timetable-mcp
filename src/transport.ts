import type { Server as HttpServer } from "node:http";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
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

export function createHttpApp(
	api: TimetableApi = timetableApi,
	serverConfig: ServerConfig = config.server,
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

	app.post(
		serverConfig.endpoint,
		async (request: Request, response: Response) => {
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
		},
	);

	app.get(serverConfig.endpoint, (_request: Request, response: Response) => {
		response.status(405).json(methodNotAllowed);
	});
	app.delete(serverConfig.endpoint, (_request: Request, response: Response) => {
		response.status(405).json(methodNotAllowed);
	});

	return app;
}

export async function startHttpServer(
	api: TimetableApi = timetableApi,
	serverConfig: ServerConfig = config.server,
): Promise<HttpServer> {
	const app = createHttpApp(api, serverConfig);
	return new Promise((resolve, reject) => {
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
