#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { config } from "./config.js";
import { startHttpServer, startStdioServer } from "./transport.js";
import { logger } from "./utils/logger.js";

function registerShutdown(close: () => Promise<void>): void {
	for (const signal of ["SIGINT", "SIGTERM"] as const) {
		process.once(signal, () => {
			logger.info("Server wird beendet", { signal });
			void close()
				.catch((error) => logger.error("Fehler beim Beenden", { error }))
				.finally(() => {
					process.exitCode = 0;
				});
		});
	}
}

export async function main(): Promise<void> {
	logger.info(`${config.server.name} v${config.server.version} startet`, {
		transport: config.server.transport,
	});

	if (config.server.transport === "http") {
		const httpServer = await startHttpServer();
		registerShutdown(
			() =>
				new Promise((resolve, reject) => {
					httpServer.close((error) => (error ? reject(error) : resolve()));
				}),
		);
		return;
	}

	const server = await startStdioServer();
	registerShutdown(() => server.close());
}

const isMain = Boolean(
	process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url,
);

if (isMain) {
	main().catch((error) => {
		logger.error("Server konnte nicht gestartet werden", { error });
		process.exitCode = 1;
	});
}

export { createServer } from "./server.js";
