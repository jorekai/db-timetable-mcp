import { describe, expect, test } from "vitest";
import { STATION_INDEX } from "../stations/stationIndex.js";
import { searchStations } from "../stations/stationSearch.js";

const first = (pattern: string) => searchStations(pattern, 5).stations[0];

describe("Bahnhofssuche", () => {
	test("das mitgelieferte Verzeichnis ist vollständig lesbar", () => {
		const lines = STATION_INDEX.split("\n");
		expect(lines.length).toBeGreaterThan(5_000);
		for (const line of lines) {
			const fields = line.split("\t");
			expect(fields, line).toHaveLength(7);
			expect(fields[0], line).toMatch(/^\d{7}(,\d{7})*$/);
			expect(fields[1], line).not.toBe("");
		}
		const evas = lines.flatMap((line) => line.split("\t")[0].split(","));
		expect(new Set(evas).size).toBe(evas.length);
	});

	test.each([
		"8000105",
		"8098105",
		"FF",
		"fft",
		"Frankfurt(Main)Hbf",
		"frankfurt main hauptbahnhof",
		" Frankfurt (Main) Hbf ",
	])("findet Frankfurt (Main) Hbf über %s", (pattern) => {
		expect(first(pattern)).toMatchObject({
			evaNo: "8000105",
			evaNumbers: ["8000105", "8098105"],
			ds100Codes: ["FF", "FFT"],
			name: "Frankfurt (Main) Hbf",
		});
	});

	test.each([
		["Köln Hbf", "8000207"],
		["koeln hbf", "8000207"],
		["Berlin Hbf", "8011160"],
		["Chóśebuz", "8010073"],
		["chosebuz", "8010073"],
		["München Hbf", "8000261"],
		["TS T", "8000096"],
	])("findet %s", (pattern, evaNo) => {
		expect(first(pattern).evaNo).toBe(evaNo);
	});

	test("stellt bei gleichem Treffer größere Bahnhöfe voran", () => {
		expect(first("Frankfurt (Main)").evaNo).toBe("8000105");
	});

	test("liefert Gleise in natürlicher Reihenfolge", () => {
		const { platforms } = first("FF");
		expect(platforms.indexOf("2")).toBeLessThan(platforms.indexOf("10"));
	});

	test("begrenzt die Liste und nennt die Gesamtzahl", () => {
		const result = searchStations("Berlin", 3);
		expect(result.stations).toHaveLength(3);
		expect(result.totalMatches).toBeGreaterThan(50);
	});

	test.each(["xyzxyz", "0000000", "???", "*"])(
		"liefert für %s eine leere Liste",
		(pattern) => {
			expect(searchStations(pattern, 5)).toEqual({
				totalMatches: 0,
				stations: [],
			});
		},
	);
});
