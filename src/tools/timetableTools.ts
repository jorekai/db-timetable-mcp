import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { TimetableApi } from "../api/timetableApi.js";
import type { ApiResult } from "../api/types.js";
import { parseBerlinTime } from "../utils/berlinTime.js";
import { AppError } from "../utils/errorHandling.js";
import { logger } from "../utils/logger.js";

const EvaNoSchema = z
	.string()
	.regex(/^\d{7}$/, "Die EVA-Nummer muss aus genau sieben Ziffern bestehen")
	.describe(
		"Siebenstellige EVA-Nummer aus findStations, z.B. 8000105 für Frankfurt (Main) Hbf",
	);

const BoardInputSchema = z.object({
	evaNo: EvaNoSchema,
	startTime: z
		.string()
		.refine((value) => parseBerlinTime(value) !== undefined, {
			message:
				"startTime muss ein gültiger ISO-8601-Zeitpunkt sein, z.B. 2026-07-17T10:00",
		})
		.optional()
		.describe(
			"Beginn des Zeitfensters in ISO 8601. Ohne Offset gilt deutsche Ortszeit, z.B. 2026-07-17T10:00. Standard: jetzt. Die DB sagt Daten bis 30 Tage in die Vergangenheit zu.",
		),
	durationMinutes: z
		.number()
		.int()
		.min(1)
		.max(480)
		.optional()
		.default(60)
		.describe("Länge des Zeitfensters in Minuten, höchstens 480"),
	platforms: z
		.array(z.string().trim().min(1).max(20))
		.max(25)
		.optional()
		.describe('Nur diese Gleise, z.B. ["7", "8"]'),
	transportTypes: z
		.array(
			z.enum([
				"HIGH_SPEED_TRAIN",
				"INTERCITY_TRAIN",
				"INTER_REGIONAL_TRAIN",
				"REGIONAL_TRAIN",
				"CITY_TRAIN",
			]),
		)
		.min(1)
		.optional()
		.describe(
			"Nur diese Produktklassen: HIGH_SPEED_TRAIN = ICE, INTERCITY_TRAIN = IC/EC, REGIONAL_TRAIN = RE/RB, CITY_TRAIN = S-Bahn. Standard: alle",
		),
	includeNearbyStops: z
		.boolean()
		.optional()
		.default(true)
		.describe(
			"Zusammengehörige Haltestellen einbeziehen, z.B. den Tiefbahnhof. Bei false nur die angegebene EVA-Nummer",
		),
	maxEntriesPerTransportType: z
		.number()
		.int()
		.min(1)
		.max(50)
		.optional()
		.default(50)
		.describe(
			"Höchstzahl der Einträge je Produktklasse. truncatedTransportTypes nennt abgeschnittene Klassen",
		),
});

const StationInputSchema = z.object({
	pattern: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.describe("Stationsname, EVA-Nummer oder DS100-Code als Suchmuster"),
	limit: z
		.number()
		.int()
		.min(1)
		.max(100)
		.optional()
		.default(20)
		.describe("Höchstzahl der Treffer; totalMatches nennt die Gesamtzahl"),
});

const ApiResultSchema = z.object({
	source: z.enum([
		"Deutsche Bahn OpenBoards API",
		"DB InfraGO OpenStation (NeTEx)",
	]),
	retrievedAt: z.string(),
	dataAsOf: z.string().optional(),
	endpoint: z.string(),
	data: z.unknown(),
});

const annotations = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: true,
};

function toolResult<T>(result: ApiResult<T>): CallToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
		structuredContent: result as unknown as Record<string, unknown>,
	};
}

function toolError(error: unknown): CallToolResult {
	const appError =
		error instanceof AppError
			? error
			: new AppError("Unerwarteter Fehler beim Abruf der Fahrplandaten");
	logger.error(appError.message, { code: appError.code, error });
	return {
		content: [
			{
				type: "text",
				text: JSON.stringify({
					error: { code: appError.code, message: appError.message },
				}),
			},
		],
		isError: true,
	};
}

async function execute<T>(
	operation: () => Promise<ApiResult<T>>,
): Promise<CallToolResult> {
	try {
		return toolResult(await operation());
	} catch (error) {
		return toolError(error);
	}
}

export function registerTimetableTools(
	server: McpServer,
	api: TimetableApi,
): void {
	server.registerTool(
		"getStationBoard",
		{
			title: "Live-Bahnhofstafel abrufen",
			description:
				"Liefert Ankünfte und Abfahrten einer Station in einem Zeitfenster, je Zughalt zusammengeführt. Für Gleise und Zeiten immer effective verwenden; planned enthält den Sollzustand. Für nur eine Richtung getDepartures oder getArrivals nutzen.",
			inputSchema: BoardInputSchema,
			outputSchema: ApiResultSchema,
			annotations,
		},
		(args) => execute(() => api.getStationBoard(args)),
	);

	server.registerTool(
		"getDepartures",
		{
			title: "Abfahrten abrufen",
			description:
				"Liefert die Abfahrten einer Station in einem Zeitfenster mit Soll- und Echtzeit, Gleis, Ziel, ausgewählten Unterwegshalten, Ausfällen und Meldungen. Ohne startTime beginnt das Fenster jetzt und umfasst 60 Minuten.",
			inputSchema: BoardInputSchema,
			outputSchema: ApiResultSchema,
			annotations,
		},
		(args) => execute(() => api.getDepartures(args)),
	);

	server.registerTool(
		"getArrivals",
		{
			title: "Ankünfte abrufen",
			description:
				"Liefert die Ankünfte einer Station in einem Zeitfenster mit Soll- und Echtzeit, Gleis, Startbahnhof, ausgewählten Unterwegshalten, Ausfällen und Meldungen. Ohne startTime beginnt das Fenster jetzt und umfasst 60 Minuten.",
			inputSchema: BoardInputSchema,
			outputSchema: ApiResultSchema,
			annotations,
		},
		(args) => execute(() => api.getArrivals(args)),
	);

	server.registerTool(
		"findStations",
		{
			title: "Bahnhöfe suchen",
			description:
				"Sucht deutsche Bahnhöfe anhand eines Namens, einer EVA-Nummer oder eines DS100-Codes und liefert Stationskennungen und Gleise. Die Suche läuft lokal in einem mitgelieferten Verzeichnis; dataAsOf nennt dessen Stand.",
			inputSchema: StationInputSchema,
			outputSchema: ApiResultSchema,
			annotations: { ...annotations, openWorldHint: false },
		},
		(args) => execute(() => api.findStations(args)),
	);
}
