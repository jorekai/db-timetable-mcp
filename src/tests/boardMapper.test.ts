import { describe, expect, test } from "vitest";
import { mapStops, mergeStops } from "../api/boardMapper.js";
import type { RawEntry } from "../api/openBoards.js";
import { board, entry } from "./fixtures.js";

const map = (raw: RawEntry, kind: "arrival" | "departure" = "departure") =>
	mapStops(
		board(kind === "arrival" ? "arrivals" : "departures", [raw]),
		[raw],
		kind,
	)[0];

const stop = (
	kind: "arrival" | "departure",
	time: string,
	overrides: Partial<RawEntry> = {},
) =>
	map(
		entry({
			time: `2026-07-17T${time}:00+02:00`,
			timeSchedule: `2026-07-17T${time}:00+02:00`,
			...overrides,
		}),
		kind,
	);

describe("OpenBoards-Abbildung", () => {
	test("übersetzt einen Eintrag in das semantische Modell", () => {
		expect(map(entry())).toEqual({
			journeyId: "journey-1",
			evaNo: "8000105",
			stationName: "Frankfurt (Main) Hbf",
			trip: {
				type: "HIGH_SPEED_TRAIN",
				category: "ICE",
				number: "123",
				line: "11",
				description: "ICE 123",
				operator: { code: "DB", name: "DB Fernverkehr AG" },
				origin: { evaNo: "8000244", name: "Mannheim Hbf" },
				destination: { evaNo: "8011160", name: "Berlin Hbf", cancelled: true },
				direction: "Berlin Hbf",
				isCancelled: false,
			},
			departure: {
				planned: {
					time: {
						raw: "2026-07-17T10:20:00+02:00",
						local: "2026-07-17T10:20",
						timezone: "Europe/Berlin",
					},
					platform: "8",
				},
				effective: {
					time: {
						raw: "2026-07-17T10:27:00+02:00",
						local: "2026-07-17T10:27",
						timezone: "Europe/Berlin",
					},
					platform: "10",
				},
				timeType: "PREVIEW",
				delayMinutes: 7,
				platformChanged: true,
				isCancelled: false,
				isAdditional: false,
				noPassengerChange: false,
				via: [{ evaNo: "8000115", name: "Fulda", additional: true }],
				messages: [
					{
						type: "cause",
						text: "Verspätung aus vorheriger Fahrt",
						code: "43",
					},
					{
						type: "disruption",
						text: "Bauarbeiten",
						shortText: "Bau",
						effect: "REDUCED_SERVICE",
					},
				],
			},
		});
	});

	test("behält das Sollgleis, wenn kein aktuelles Gleis gemeldet ist", () => {
		expect(map(entry({ platform: undefined })).departure).toMatchObject({
			effective: { platform: "8" },
			platformChanged: false,
		});
	});

	test("meldet ein neues Gleis ohne Sollgleis nicht als Gleiswechsel", () => {
		const { departure } = map(entry({ platformSchedule: undefined }));
		expect(departure?.planned).not.toHaveProperty("platform");
		expect(departure).toMatchObject({
			effective: { platform: "10" },
			platformChanged: false,
		});
	});

	test("verträgt verfrühte Züge und Einträge mit Minimalangaben", () => {
		const raw: RawEntry = {
			evaNumber: "1234567",
			journeyId: "j",
			time: "2026-07-17T10:18:00+02:00",
			timeSchedule: "2026-07-17T10:20:00+02:00",
			timeType: "REAL",
			cancelled: true,
			additional: true,
			transport: {
				type: "CITY_TRAIN",
				category: "S",
				journeyNumber: 1,
				direction: {
					stopPlaces: [{ evaNumber: "8000115" }, { evaNumber: "0000001" }],
				},
				replacementTransport: {},
			},
		};
		const mapped = mapStops({}, [raw], "departure")[0];

		expect(mapped).not.toHaveProperty("stationName");
		expect(mapped.trip).toMatchObject({
			direction: "8000115 / 0000001",
			replacementTransport: "unknown",
		});
		expect(mapped.departure).toMatchObject({
			delayMinutes: -2,
			isCancelled: true,
			isAdditional: true,
			via: [],
			messages: [],
		});
	});

	test("führt nur Einträge derselben Fahrt am selben Halt zusammen", () => {
		const stops = mergeStops(
			[
				stop("arrival", "10:00"),
				stop("arrival", "10:05", { evaNumber: "8098105" }),
				stop("arrival", "10:30", { journeyId: "endet-hier" }),
			],
			[
				stop("departure", "10:10"),
				stop("departure", "10:02", { journeyId: "beginnt-hier" }),
			],
		);

		expect(
			stops.map((s) => [
				s.journeyId,
				s.evaNo,
				Boolean(s.arrival),
				Boolean(s.departure),
			]),
		).toEqual([
			["beginnt-hier", "8000105", false, true],
			["journey-1", "8098105", true, false],
			["journey-1", "8000105", true, true],
			["endet-hier", "8000105", true, false],
		]);
	});

	test("ordnet bei Ringlinien jeder Abfahrt ihre eigene Ankunft zu", () => {
		const stops = mergeStops(
			[stop("arrival", "10:00"), stop("arrival", "11:00")],
			[
				stop("departure", "11:01"),
				stop("departure", "10:01"),
				stop("departure", "09:01"),
			],
		);

		expect(
			stops.map((s) => [
				s.arrival?.planned.time.local.slice(11),
				s.departure?.planned.time.local.slice(11),
			]),
		).toEqual([
			[undefined, "09:01"],
			["10:00", "10:01"],
			["11:00", "11:01"],
		]);
	});
});
