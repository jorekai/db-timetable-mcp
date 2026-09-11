/*
 * Konfiguration des Browsers. Der Worker-Endpunkt ist öffentlich, kein Secret.
 * Alle Geheimnisse bleiben Worker-Secrets. `?endpoint=` erlaubt lokale Tests
 * gegen `npm run dev:worker` (Port 8791), ohne die Produktions-Allowlist zu
 * berühren.
 */

export const MCP_ENDPOINT =
	"https://db-timetable-mcp.nils-jorek6753.workers.dev/mcp";

/** Protokollversion, die der Client im `initialize` vorschlägt. */
export const PROTOCOL_VERSION = "2025-06-18";

export const CLIENT_INFO = {
	name: "db-timetable-mcp-web",
	version: "1.0.0",
} as const;

/** Wie viele kommende Abfahrten gezeigt werden. */
export const BOARD_SIZE = 20;

/** Züge, die vor höchstens dieser Zeit abgefahren sind, bleiben sichtbar. */
export const GRACE_MS = 2 * 60 * 1000;

/** Aktualisierungsintervall in Sekunden. Nicht unter die Live-TTL von 30 s. */
export const REFRESH_SECONDS = 30;

/** Endpunkt aus der URL, sonst der Standard. Nur im Browser aufrufen. */
export function resolveEndpoint(): string {
	if (typeof window === "undefined") return MCP_ENDPOINT;
	const override = new URLSearchParams(window.location.search).get("endpoint");
	return override && override.length > 0 ? override : MCP_ENDPOINT;
}

/**
 * Nur für lokale Tests: `?simulate=500` schickt den Header
 * X-Simulate-Upstream-Error mit. Der Worker honoriert ihn nur, wenn
 * ALLOW_SIMULATION=1 ist (lokal); in Produktion ist er wirkungslos.
 */
export function resolveSimulation(): string | null {
	if (typeof window === "undefined") return null;
	return new URLSearchParams(window.location.search).get("simulate");
}
