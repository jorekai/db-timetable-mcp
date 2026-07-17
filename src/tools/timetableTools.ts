import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { TimetableApi } from "../api/timetableApi.js";
import type { ApiResult } from "../api/types.js";
import { AppError } from "../utils/errorHandling.js";
import { logger } from "../utils/logger.js";

const EvaNoSchema = z
	.string()
	.regex(/^\d{7}$/, "Die EVA-Nummer muss aus genau sieben Ziffern bestehen")
	.describe("Siebenstellige EVA-Nummer, z.B. 8000105 für Frankfurt(Main)Hbf");

function isValidDbDate(value: string): boolean {
	const match = /^(\d{2})(\d{2})(\d{2})$/.exec(value);
	if (!match) return false;
	const year = 2000 + Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(year, month - 1, day));
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}

const DateSchema = z
	.string()
	.regex(/^\d{6}$/, "Das Datum muss das Format YYMMDD haben")
	.refine(isValidDbDate, "Das Datum muss ein gültiger Kalendertag sein")
	.describe("Betriebstag im DB-Format YYMMDD, z.B. 260717");

const HourSchema = z
	.string()
	.regex(/^([01]\d|2[0-3])$/, "Die Stunde muss zwischen 00 und 23 liegen")
	.describe("Stunde im 24-Stunden-Format HH, z.B. 10");

const IncludeRawXmlSchema = z
	.boolean()
	.optional()
	.default(false)
	.describe("Zusätzlich die unveränderte DB-XML-Antwort zurückgeben");

const TimetableInputSchema = z.object({
	evaNo: EvaNoSchema,
	includeRawXml: IncludeRawXmlSchema,
});

const PlanInputSchema = TimetableInputSchema.extend({
	date: DateSchema,
	hour: HourSchema,
});

const StationInputSchema = z.object({
	pattern: z
		.string()
		.trim()
		.min(1)
		.max(100)
		.describe("Stationsname, EVA-Nummer oder DS100-Code als Suchmuster"),
	includeRawXml: IncludeRawXmlSchema,
});

const RawXmlSchema = z.union([z.string(), z.record(z.string(), z.string())]);

const ApiResultSchema = z.object({
	source: z.literal("Deutsche Bahn Timetables API"),
	retrievedAt: z.string(),
	endpoint: z.string(),
	data: z.unknown(),
	rawXml: RawXmlSchema.optional(),
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
				"Liefert eine zuverlässige Bahnhofstafel, indem der Sollfahrplan der gewählten Stunde mit allen bekannten Echtzeitänderungen zusammengeführt wird. Für Gleise und Zeiten immer effective verwenden; planned und changed erklären die Abweichung.",
			inputSchema: PlanInputSchema,
			outputSchema: ApiResultSchema,
			annotations,
		},
		(args) => execute(() => api.getStationBoard(args)),
	);

	server.registerTool(
		"getCurrentTimetable",
		{
			title: "Vollständige Fahrplanänderungen abrufen",
			description:
				"Liefert den vollständigen aktuell bekannten Änderungsbestand der DB Timetables API für eine Station. Das sind Änderungsdaten und keine fertige Bahnhofstafel; für eine zusammengeführte Anzeige getStationBoard verwenden.",
			inputSchema: TimetableInputSchema,
			outputSchema: ApiResultSchema,
			annotations,
		},
		(args) => execute(() => api.getCurrentTimetable(args)),
	);

	server.registerTool(
		"getRecentChanges",
		{
			title: "Jüngste Fahrplanänderungen abrufen",
			description:
				"Liefert ausschließlich Änderungen, die der DB Timetables API innerhalb der letzten zwei Minuten bekannt wurden. Dieses Delta eignet sich für häufige Aktualisierungen nach einem initialen vollständigen Abruf.",
			inputSchema: TimetableInputSchema,
			outputSchema: ApiResultSchema,
			annotations,
		},
		(args) => execute(() => api.getRecentChanges(args)),
	);

	server.registerTool(
		"getPlannedTimetable",
		{
			title: "Sollfahrplan abrufen",
			description:
				"Liefert den statischen Sollfahrplan einer Station für einen Betriebstag und eine Stunde. Die Antwort enthält geplante Zeiten, Gleise und Fahrtwege, jedoch keine später bekannt gewordenen Echtzeitabweichungen.",
			inputSchema: PlanInputSchema,
			outputSchema: ApiResultSchema,
			annotations,
		},
		(args) => execute(() => api.getPlannedTimetable(args)),
	);

	server.registerTool(
		"findStations",
		{
			title: "Bahnhöfe suchen",
			description:
				"Sucht Stationen anhand eines Namenspräfixes, einer EVA-Nummer oder eines DS100-Codes und liefert eindeutige Stationskennungen sowie bekannte Gleise und Metastationen als strukturiertes JSON.",
			inputSchema: StationInputSchema,
			outputSchema: ApiResultSchema,
			annotations,
		},
		(args) => execute(() => api.findStations(args)),
	);
}
