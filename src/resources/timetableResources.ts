import {
	type McpServer,
	ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TimetableApi } from "../api/timetableApi.js";

const DATA_MODEL = {
	event: {
		effective:
			"Diese Werte für die tatsächliche Anzeige verwenden. Änderungen überschreiben hier jeweils die entsprechenden Sollwerte.",
		planned: "Ursprüngliche Sollzeit, Sollgleis und geplanter Fahrtweg der DB.",
		changed:
			"Von der DB gemeldete Änderung an Zeit, Gleis, Status oder Fahrtweg; nicht gesetzte Felder bleiben wie geplant.",
		delayMinutes:
			"Differenz zwischen geänderter und geplanter lokaler Zeit in Minuten.",
		platformChanged:
			"True, wenn sich das geänderte Gleis vom geplanten Gleis unterscheidet.",
		isCancelled:
			"True, wenn die Ankunft oder Abfahrt als ausgefallen markiert ist.",
	},
	timestamp: {
		raw: "Unveränderter DB-Zeitstempel im Format YYMMDDHHmm.",
		local: "Lesbare lokale Zeit ohne erfundenen UTC-Offset.",
		timezone: "IANA-Zeitzone Europe/Berlin.",
	},
	usage:
		"Für eine Bahnhofstafel getStationBoard verwenden. getCurrentTimetable enthält nur den vollständigen Änderungsbestand, getRecentChanges lediglich ein zweiminütiges Delta.",
};

function variable(value: string | string[]): string {
	return Array.isArray(value) ? value[0] : value;
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

export function registerTimetableResources(
	server: McpServer,
	api: TimetableApi,
): void {
	server.registerResource(
		"data-model",
		"db-timetable://docs/data-model",
		{
			title: "DB Timetable Datenmodell",
			description:
				"Semantik der strukturierten Zeiten, Gleise und Echtzeitänderungen",
			mimeType: "application/json",
		},
		(uri) => jsonResource(uri, DATA_MODEL),
	);

	server.registerResource(
		"current-timetable",
		new ResourceTemplate("db-api:timetable/current/{evaNo}", {
			list: undefined,
		}),
		{
			title: "Vollständige Fahrplanänderungen",
			description:
				"Strukturierter vollständiger Änderungsbestand einer Station",
			mimeType: "application/json",
		},
		async (uri, { evaNo }) =>
			jsonResource(
				uri,
				await api.getCurrentTimetable({ evaNo: variable(evaNo) }),
			),
	);

	server.registerResource(
		"recent-changes",
		new ResourceTemplate("db-api:timetable/changes/{evaNo}", {
			list: undefined,
		}),
		{
			title: "Jüngste Fahrplanänderungen",
			description: "Strukturiertes zweiminütiges Änderungsdelta einer Station",
			mimeType: "application/json",
		},
		async (uri, { evaNo }) =>
			jsonResource(uri, await api.getRecentChanges({ evaNo: variable(evaNo) })),
	);

	server.registerResource(
		"planned-timetable",
		new ResourceTemplate("db-api:timetable/planned/{evaNo}/{date}/{hour}", {
			list: undefined,
		}),
		{
			title: "Geplanter Fahrplan",
			description: "Strukturierter Sollfahrplan einer Stationsstunde",
			mimeType: "application/json",
		},
		async (uri, { evaNo, date, hour }) =>
			jsonResource(
				uri,
				await api.getPlannedTimetable({
					evaNo: variable(evaNo),
					date: variable(date),
					hour: variable(hour),
				}),
			),
	);

	server.registerResource(
		"station-search",
		new ResourceTemplate("db-api:station/{pattern}", { list: undefined }),
		{
			title: "Stationssuche",
			description: "Strukturierte Stationsdaten für ein Suchmuster",
			mimeType: "application/json",
		},
		async (uri, { pattern }) =>
			jsonResource(uri, await api.findStations({ pattern: variable(pattern) })),
	);
}
