import { beforeEach, describe, expect, test, vi } from "vitest";
import { TimetableApiClient } from "../api/timetableApi.js";
import {
	AuthenticationError,
	ResourceNotFoundError,
} from "../utils/errorHandling.js";

const timetableXml = `<timetable station="Frankfurt(Main)Hbf" eva="8000105"><s id="trip-1" eva="8000105"><tl c="ICE" n="123" o="80"/><dp pt="2607171020" pp="8"/></s></timetable>`;
const changesXml = `<timetable station="Frankfurt(Main)Hbf" eva="8000105"><s id="trip-1" eva="8000105"><dp ct="2607171027" cp="10"/></s></timetable>`;
const stationsXml = `<stations><station eva="8000105" ds100="FF" name="Frankfurt(Main)Hbf" p="1|2"/></stations>`;

function response(body: string, status = 200): Response {
	return new Response(body, {
		status,
		statusText: status === 200 ? "OK" : "Error",
	});
}

describe("TimetableApiClient", () => {
	const fetchMock = vi.fn<typeof fetch>();
	const createClient = (credentials = true) =>
		new TimetableApiClient(
			{
				baseUrl: "https://db.test/v1",
				clientId: credentials ? "client-id" : "",
				clientSecret: credentials ? "client-secret" : "",
				timeoutMs: 5_000,
			},
			fetchMock,
			() => new Date("2026-07-17T08:00:00.000Z"),
		);

	beforeEach(() => fetchMock.mockReset());

	test("liefert strukturierte Fahrplandaten mit Herkunftsmetadaten", async () => {
		fetchMock.mockResolvedValue(response(timetableXml));

		const result = await createClient().getPlannedTimetable({
			evaNo: "8000105",
			date: "260717",
			hour: "10",
		});

		expect(result).toMatchObject({
			source: "Deutsche Bahn Timetables API",
			retrievedAt: "2026-07-17T08:00:00.000Z",
			endpoint: "/plan/8000105/260717/10",
			data: { station: { evaNo: "8000105" } },
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://db.test/v1/plan/8000105/260717/10",
			expect.objectContaining({
				headers: expect.objectContaining({
					"DB-Client-Id": "client-id",
					"DB-Api-Key": "client-secret",
					Accept: "application/xml",
				}),
			}),
		);
	});

	test("fügt Roh-XML nur auf ausdrücklichen Wunsch bei", async () => {
		fetchMock.mockResolvedValue(response(timetableXml));

		const result = await createClient().getCurrentTimetable({
			evaNo: "8000105",
			includeRawXml: true,
		});

		expect(result.rawXml).toBe(timetableXml);
	});

	test("kodiert Suchmuster als einzelnes URL-Segment", async () => {
		fetchMock.mockResolvedValue(response(stationsXml));

		const result = await createClient().findStations({
			pattern: "Frankfurt Hbf/Flughafen",
		});

		expect(fetchMock.mock.calls[0][0]).toBe(
			"https://db.test/v1/station/Frankfurt%20Hbf%2FFlughafen",
		);
		expect(result.data[0].platforms).toEqual(["1", "2"]);
	});

	test("verbindet Plan und Echtzeitänderungen zu einer korrekten Bahnhofstafel", async () => {
		fetchMock
			.mockResolvedValueOnce(response(timetableXml))
			.mockResolvedValueOnce(response(changesXml));

		const result = await createClient().getStationBoard({
			evaNo: "8000105",
			date: "260717",
			hour: "10",
			includeRawXml: true,
		});

		expect(result.data.stops[0].departure).toMatchObject({
			planned: { platform: "8" },
			changed: { platform: "10" },
			effective: { platform: "10" },
			delayMinutes: 7,
		});
		expect(result.rawXml).toEqual({
			planned: timetableXml,
			changes: changesXml,
		});
	});

	test("meldet fehlende Credentials vor einem Netzwerkaufruf", async () => {
		await expect(
			createClient(false).getRecentChanges({ evaNo: "8000105" }),
		).rejects.toBeInstanceOf(AuthenticationError);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("übersetzt 404-Antworten in einen fachlichen Fehler", async () => {
		fetchMock.mockResolvedValue(response("not found", 404));

		await expect(
			createClient().getCurrentTimetable({ evaNo: "0000000" }),
		).rejects.toBeInstanceOf(ResourceNotFoundError);
	});
});
