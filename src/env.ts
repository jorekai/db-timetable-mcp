import dotenv from "dotenv";
import { TimetableApiClient } from "./api/timetableApi.js";
import { createConfig, getEnvFilePaths } from "./config.js";
import { logger } from "./utils/logger.js";

/**
 * Node-Startpfad: lädt `.env`, erzeugt die Laufzeitkonfiguration und den
 * Standard-Client.
 *
 * Alle Node-spezifischen Seiteneffekte (dotenv, `process.env`, `node:path`)
 * liegen bewusst hier und nicht in `config.ts`, `server.ts` oder
 * `api/timetableApi.ts`. Nur so lassen sich Kernlogik und Werkzeuge unverändert
 * in Edge-Runtimes wie Cloudflare Workers ausführen.
 */

dotenv.config({
	path: getEnvFilePaths(process.env, import.meta.url, process.cwd()),
	quiet: true,
});

export const config = createConfig(process.env);

export const timetableApi = new TimetableApiClient(config.api);

logger.setLevel(config.logging.level);

export default config;
