/**
 * Worker-Bindings und -Konstanten.
 *
 * ZUGANGSDATEN: DB_TIMETABLE_CLIENT_ID und DB_TIMETABLE_CLIENT_SECRET werden
 * ausschließlich als Worker-Secret gesetzt (`wrangler secret put`) und tauchen
 * nie in diesem Repository, im Frontend oder in Logs auf.
 */

export interface Env {
	/** Secret. Nicht als var in wrangler.toml eintragen. */
	DB_TIMETABLE_CLIENT_ID: string;
	/** Secret. Nicht als var in wrangler.toml eintragen. */
	DB_TIMETABLE_CLIENT_SECRET: string;
	/** Kommaseparierte Liste erlaubter Origins, z.B. "https://jorekai.github.io". */
	ALLOWED_ORIGINS?: string;
	/** "production" oder "development". */
	ENVIRONMENT?: string;
	/** Nur für lokale Tests: schaltet den Header X-Simulate-Upstream-Error frei. */
	ALLOW_SIMULATION?: string;
}

/** Pfad des MCP-Endpunkts (Streamable HTTP). */
export const MCP_PATH = "/mcp";

/** Healthcheck-Pfad, ohne MCP-Semantik. */
export const HEALTH_PATH = "/healthz";

export const API_BASE_URL =
	"https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1";

/**
 * Harte Obergrenze pro Upstream-Aufruf. Ein Kontingent-freundlicher Wert:
 * Aufrufe, die länger brauchen, werden abgebrochen und aus dem Cache bedient.
 */
export const UPSTREAM_TIMEOUT_MS = 8_000;

/** Präfix der synthetischen Cache-Keys innerhalb der Worker-Zone. */
export const CACHE_PATH_PREFIX = "/__db-mcp-cache";

/**
 * Header, über die der Worker Cache-Zustand nach außen gibt. Additiv: der
 * MCP-Tool-Vertrag bleibt unverändert, das Frontend zeigt damit an, ob eine
 * Antwort aus dem Cache kam und wie alt sie ist.
 */
export const META_HEADERS = {
	cache: "X-MCP-Cache",
	upstreamCalls: "X-MCP-Upstream-Calls",
	stale: "X-MCP-Cache-Stale",
	retrievedAt: "X-MCP-Retrieved-At",
} as const;
