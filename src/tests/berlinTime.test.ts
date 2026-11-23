import { describe, expect, test } from "vitest";
import { parseBerlinTime, toTimestamp } from "../utils/berlinTime.js";

describe("Berliner Ortszeit", () => {
	test.each([
		["2026-07-17T10:00", "2026-07-17T08:00:00.000Z"],
		["2026-12-01T10:00", "2026-12-01T09:00:00.000Z"],
		["2026-07-17T10:00:30", "2026-07-17T08:00:30.000Z"],
		["2026-07-17T10:00Z", "2026-07-17T10:00:00.000Z"],
		["2026-07-17T10:00:00.500+02:00", "2026-07-17T08:00:00.500Z"],
		["2026-01-01T00:00", "2025-12-31T23:00:00.000Z"],
		["2028-02-29T12:00", "2028-02-29T11:00:00.000Z"],
		// Tage der Zeitumstellung 2026: 29. März und 25. Oktober
		["2026-03-29T01:59", "2026-03-29T00:59:00.000Z"],
		["2026-03-29T02:30", "2026-03-29T01:30:00.000Z"],
		["2026-03-29T03:00", "2026-03-29T01:00:00.000Z"],
		["2026-10-25T01:59", "2026-10-24T23:59:00.000Z"],
		["2026-10-25T02:30", "2026-10-25T00:30:00.000Z"],
		["2026-10-25T03:00", "2026-10-25T02:00:00.000Z"],
	])("liest %s", (value, expected) => {
		expect(parseBerlinTime(value)?.toISOString()).toBe(expected);
	});

	test.each([
		"",
		"10:00",
		"2026-07-17",
		"2026-02-31T10:00",
		"2026-02-29T10:00",
		"2026-13-01T10:00",
		"2026-00-10T10:00",
		"2026-07-17T24:00",
		"2026-07-17T10:60",
		"2026-07-17T10:00+99:99",
		"2026-02-31T10:00Z",
		"heute",
	])("weist %s zurück", (value) => {
		expect(parseBerlinTime(value)).toBeUndefined();
	});

	test("gibt UTC als Ortszeit wieder, auch über Mitternacht", () => {
		expect(toTimestamp("2026-07-16T22:05:00Z")).toEqual({
			raw: "2026-07-16T22:05:00Z",
			local: "2026-07-17T00:05",
			timezone: "Europe/Berlin",
		});
	});
});
