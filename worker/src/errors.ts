import { AppError } from "../../src/utils/errorHandling.js";

/**
 * Fehler mit stabilen Codes für den Weg Worker → Browser.
 *
 * Beide erben von `AppError`, damit die geteilten Tool-Handler
 * (src/tools/timetableTools.ts) sie unverändert in einen MCP-Fehler mit
 * `{ error: { code, message } }` übersetzen. Upstream-Meldungen im Wortlaut
 * verlassen den Worker nie; die Texte hier sind bewusst generisch.
 */

export class RateLimitError extends AppError {
	constructor(
		message: string,
		readonly retryAfterSeconds: number,
	) {
		super(message, "RATE_LIMITED", 429);
		this.name = "RateLimitError";
	}
}

export class UpstreamUnavailableError extends AppError {
	constructor(code: string, message: string) {
		super(message, code, 503);
		this.name = "UpstreamUnavailableError";
	}
}
