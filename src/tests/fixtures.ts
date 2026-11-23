import type { RawBoard, RawEntry } from "../api/openBoards.js";

/** Nachgebaute Antworten nach OpenBoards-Spezifikation 1.0.3, keine Live-Daten. */
const NAMES: Record<string, string> = {
	"8000105": "Frankfurt (Main) Hbf",
	"8098105": "Frankfurt Hbf (tief)",
	"8000244": "Mannheim Hbf",
	"8000115": "Fulda",
	"8011160": "Berlin Hbf",
};

export function entry(overrides: Partial<RawEntry> = {}): RawEntry {
	return {
		evaNumber: "8000105",
		journeyId: "journey-1",
		time: "2026-07-17T10:27:00+02:00",
		timeSchedule: "2026-07-17T10:20:00+02:00",
		timeType: "PREVIEW",
		platform: { name: "10" },
		platformSchedule: { name: "8" },
		messages: [1, 2, 99],
		journeyInfo: {
			origin: { evaNumber: "8000244" },
			destination: { evaNumber: "8011160", cancelled: true },
		},
		transport: {
			type: "HIGH_SPEED_TRAIN",
			category: "ICE",
			journeyNumber: 123,
			journeyDescription: "ICE 123",
			line: { name: "11" },
			administrationId: "80____",
			direction: { texts: ["Berlin Hbf"] },
			via: [{ evaNumber: "8000115", additional: true }],
		},
		...overrides,
	};
}

export function board(
	kind: "arrivals" | "departures",
	entries: RawEntry[],
	overrides: Partial<RawBoard> = {}
): RawBoard {
	return {
		administrations: [
			{
				administrationId: "80____",
				operatorCode: "DB",
				operatorName: "DB Fernverkehr AG",
			},
		],
		[kind]: entries,
		messages: {
			risCauseCodes: [
				{
					messageID: 1,
					code: 43,
					descriptions: [
						{ language: "eng", text: "Delay of an earlier journey" },
						{ language: "deu", text: "Verspätung aus vorheriger Fahrt" },
					],
				},
			],
			disruptions: [
				{
					messageID: 2,
					effect: "REDUCED_SERVICE",
					descriptions: [{ language: "deu", text: "Bauarbeiten", textShort: "Bau" }],
				},
			],
			notes: [{ messageID: 3, descriptions: [] }],
		},
		meta: { consideredStopPlaces: ["8000105", "8098105"] },
		stopPlaces: Object.entries(NAMES).map(([evaNumber, name]) => ({
			evaNumber,
			localizedNames: [{ language: "deu", name }],
		})),
		...overrides,
	};
}
