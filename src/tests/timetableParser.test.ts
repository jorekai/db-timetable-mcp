import { describe, expect, test } from "vitest";
import {
	mergeTimetables,
	parseStationsXml,
	parseTimetableXml,
} from "../api/timetableParser.js";

const plannedXml = `<?xml version="1.0" encoding="UTF-8"?>
<timetable station="Frankfurt(Main)Hbf" eva="8000105">
  <s id="-123-260717-1" eva="8000105">
    <tl c="ICE" n="123" o="80" t="p" />
    <ar pt="2607171015" pp="7" ppth="Mannheim Hbf|Frankfurt Flughafen" ps="p" />
    <dp pt="2607171020" pp="8" ppth="Hanau Hbf|Fulda" ps="p" />
  </s>
</timetable>`;

const changesXml = `<?xml version="1.0" encoding="UTF-8"?>
<timetable station="Frankfurt(Main)Hbf" eva="8000105">
  <s id="-123-260717-1" eva="8000105">
    <ar ct="2607171020" cp="9" cpth="Mannheim Hbf|Frankfurt Flughafen" cs="p">
      <m id="msg-1" t="d" ts="2607171000" ext="Verspätung aus vorheriger Fahrt" />
    </ar>
    <dp ct="2607171027" cp="10" cpth="Hanau Hbf|Fulda" cs="p" />
  </s>
</timetable>`;

describe("DB timetable XML parser", () => {
	test("übersetzt DB-Kürzel in ein semantisches Fahrplanmodell", () => {
		const timetable = parseTimetableXml(plannedXml);
		const stop = timetable.stops[0];

		expect(timetable.station).toEqual({
			evaNo: "8000105",
			name: "Frankfurt(Main)Hbf",
		});
		expect(stop.trip).toMatchObject({
			category: "ICE",
			number: "123",
			operator: "80",
			type: "passenger",
		});
		expect(stop.arrival?.planned).toMatchObject({
			platform: "7",
			path: ["Mannheim Hbf", "Frankfurt Flughafen"],
			status: "planned",
			time: {
				raw: "2607171015",
				local: "2026-07-17T10:15",
				timezone: "Europe/Berlin",
			},
		});
		expect(stop.arrival?.effective).toEqual(stop.arrival?.planned);
	});

	test("führt Solldaten und Änderungen zusammen, ohne Gleise zu verwechseln", () => {
		const merged = mergeTimetables(
			parseTimetableXml(plannedXml),
			parseTimetableXml(changesXml),
		);
		const stop = merged.stops[0];

		expect(stop.arrival).toMatchObject({
			planned: { platform: "7" },
			changed: { platform: "9" },
			effective: { platform: "9" },
			delayMinutes: 5,
			platformChanged: true,
			isCancelled: false,
		});
		expect(stop.departure).toMatchObject({
			planned: { platform: "8" },
			changed: { platform: "10" },
			effective: { platform: "10" },
			delayMinutes: 7,
			platformChanged: true,
		});
		expect(stop.arrival?.messages?.[0]).toMatchObject({
			id: "msg-1",
			type: "cause_of_delay",
			text: "Verspätung aus vorheriger Fahrt",
		});
	});

	test("behält das Sollgleis, wenn die DB nur eine Zeitänderung meldet", () => {
		const timeOnlyChanges = parseTimetableXml(
			`<timetable station="Frankfurt(Main)Hbf" eva="8000105"><s id="-123-260717-1" eva="8000105"><dp ct="2607171027" /></s></timetable>`,
		);
		const merged = mergeTimetables(
			parseTimetableXml(plannedXml),
			timeOnlyChanges,
		);

		expect(merged.stops[0].departure?.effective).toMatchObject({
			time: { local: "2026-07-17T10:27" },
			platform: "8",
			path: ["Hanau Hbf", "Fulda"],
		});
	});

	test("normalisiert einzelne Stationen und Plattformlisten", () => {
		const stations = parseStationsXml(
			`<stations><station eva="8000105" ds100="FF" name="Frankfurt(Main)Hbf" p="1|2|3" meta="8002041|8002050" /></stations>`,
		);

		expect(stations).toEqual([
			{
				evaNo: "8000105",
				ds100: "FF",
				name: "Frankfurt(Main)Hbf",
				platforms: ["1", "2", "3"],
				metaStations: ["8002041", "8002050"],
			},
		]);
	});

	test("übernimmt die angefragte EVA-Nummer, wenn die Antwort keine trägt", () => {
		// `/plan` nennt die Nummer weder am Root noch am Halt.
		const planXml = `<timetable station="Frankfurt(Main)Hbf"><s id="trip-1"><tl c="ICE" n="123" o="80" /><dp pt="2607171020" pp="8" /></s></timetable>`;

		const timetable = parseTimetableXml(planXml, "8000105");

		expect(timetable.station.evaNo).toBe("8000105");
		expect(timetable.stops).toHaveLength(1);
		expect(timetable.stops[0].evaNo).toBe("8000105");
		expect(timetable.stops[0].departure?.effective.platform).toBe("8");
	});

	test("weist fehlerhaftes XML mit einer verständlichen Meldung zurück", () => {
		expect(() => parseTimetableXml("<timetable><s></timetable>")).toThrow(
			"Ungültige XML-Antwort der DB Timetables API",
		);
	});
});
