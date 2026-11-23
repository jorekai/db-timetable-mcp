import { type McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TimetableApi } from "../api/timetableApi.js";
import { InvalidInputError } from "../utils/errorHandling.js";

const DATA_MODEL = {
	event: {
		effective:
			"Diese Werte für die tatsächliche Anzeige verwenden: aktuelle Zeit und aktuelles Gleis.",
		planned: "Ursprüngliche Sollzeit und Sollgleis der DB.",
		timeType:
			"Herkunft von effective.time: SCHEDULE = Sollzeit ohne Echtzeit, PREVIEW = Prognose, REAL = bereits eingetreten.",
		delayMinutes:
			"Differenz zwischen effective.time und planned.time in Minuten, auf ganze Minuten gerundet.",
		platformChanged: "True, wenn sich das aktuelle Gleis vom Sollgleis unterscheidet.",
		isCancelled: "True, wenn die Ankunft oder Abfahrt ausfällt.",
		isAdditional:
			"True bei einem zusätzlichen Halt. Zusammen mit isCancelled ist es ein zurückgenommener Zusatzhalt.",
		noPassengerChange: "True, wenn Ein- oder Aussteigen nicht möglich ist.",
		via: "Auswahl der Unterwegshalte (Ankunft: frühere, Abfahrt: kommende). Nicht vollständig: ein fehlender Halt heißt nicht, dass der Zug dort nicht hält.",
		messages: "Meldungen zum Halt: disruption, cause, quality, note oder attribute.",
	},
	stop: {
		arrival:
			"Fehlt, wenn die Fahrt hier beginnt oder die Ankunft außerhalb des Zeitfensters liegt.",
		departure:
			"Fehlt, wenn die Fahrt hier endet oder die Abfahrt außerhalb des Zeitfensters liegt.",
		evaNo:
			"EVA-Nummer des konkreten Halts; kann bei einbezogenen Nachbarhalten von der Anfrage abweichen.",
	},
	board: {
		truncatedTransportTypes:
			"Nicht leer, wenn Einträge fehlen. Dann das Zeitfenster verkürzen oder transportTypes einschränken.",
		consideredStopPlaces: "Alle Haltestellen, die in die Tafel eingeflossen sind.",
	},
	timestamp: {
		raw: "Unveränderter ISO-8601-Zeitstempel.",
		local: "Lesbare Ortszeit, minutengenau.",
		timezone: "IANA-Zeitzone Europe/Berlin.",
	},
	usage:
		"Erst findStations für die EVA-Nummer, dann getDepartures, getArrivals oder für beides getStationBoard. Nur Schienenverkehr an deutschen Stationen.",
};

function variable(value: string | string[]): string {
	// Das SDK liefert URI-Variablen prozentkodiert.
	try {
		return decodeURIComponent(Array.isArray(value) ? value[0] : value);
	} catch {
		throw new InvalidInputError("Die Ressourcen-URI ist fehlerhaft kodiert");
	}
}

function jsonResource(uri: URL, value: unknown) {
	return {
		contents: [
			{
				uri: uri.href,
				mimeType: "application/json",
				text: JSON.stringify(value, null, 2),
			},
		],
	};
}

export function registerTimetableResources(server: McpServer, api: TimetableApi): void {
	server.registerResource(
		"data-model",
		"db-timetable://docs/data-model",
		{
			title: "DB Timetable Datenmodell",
			description: "Semantik der strukturierten Zeiten, Gleise und Echtzeitänderungen",
			mimeType: "application/json",
		},
		(uri) => jsonResource(uri, DATA_MODEL)
	);

	const boards = [
		{
			name: "board",
			title: "Bahnhofstafel",
			description: "Ankünfte und Abfahrten der nächsten 60 Minuten",
			load: (evaNo: string) => api.getStationBoard({ evaNo }),
		},
		{
			name: "departures",
			title: "Abfahrten",
			description: "Abfahrten der nächsten 60 Minuten",
			load: (evaNo: string) => api.getDepartures({ evaNo }),
		},
		{
			name: "arrivals",
			title: "Ankünfte",
			description: "Ankünfte der nächsten 60 Minuten",
			load: (evaNo: string) => api.getArrivals({ evaNo }),
		},
	];

	for (const board of boards) {
		server.registerResource(
			board.name,
			new ResourceTemplate(`db-api:${board.name}/{evaNo}`, {
				list: undefined,
			}),
			{
				title: board.title,
				description: board.description,
				mimeType: "application/json",
			},
			async (uri, { evaNo }) => jsonResource(uri, await board.load(variable(evaNo)))
		);
	}

	server.registerResource(
		"station-search",
		new ResourceTemplate("db-api:station/{pattern}", { list: undefined }),
		{
			title: "Stationssuche",
			description: "Strukturierte Stationsdaten für ein Suchmuster",
			mimeType: "application/json",
		},
		async (uri, { pattern }) =>
			jsonResource(uri, await api.findStations({ pattern: variable(pattern) }))
	);
}
