import { beforeEach, describe, expect, test, vi } from "vitest";
import { TimetableApiClient } from "../api/timetableApi.js";
import { board, entry } from "./fixtures.js";

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status });

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
	const body = (call = 0) =>
		JSON.parse(String(fetchMock.mock.calls[call][1]?.body));

	beforeEach(() => {
		fetchMock.mockReset();
	});

	test("fragt Abfahrten mit Zugangsdaten, Zeitfenster und Vorgaben ab", async () => {
		fetchMock.mockResolvedValue(json(board("departures", [entry()])));

		const result = await createClient().getDepartures({ evaNo: "8000105" });

		expect(fetchMock).toHaveBeenCalledWith(
			"https://db.test/v1/departures",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					"DB-Client-ID": "client-id",
					"DB-Api-Key": "client-secret",
					"Content-Type": "application/json",
				}),
			}),
		);
		expect(body()).toEqual({
			stopPlaceOrStation: { evaNumbers: ["8000105"] },
			timeWindow: {
				timeStart: "2026-07-17T08:00:00.000Z",
				timeEnd: "2026-07-17T09:00:00.000Z",
			},
			maxEntriesPerTransportType: 50,
			languages: ["deu"],
		});
		expect(result).toMatchObject({
			source: "Deutsche Bahn OpenBoards API",
			retrievedAt: "2026-07-17T08:00:00.000Z",
			endpoint: "/departures",
			data: {
				station: { evaNo: "8000105", name: "Frankfurt (Main) Hbf" },
				window: {
					start: { local: "2026-07-17T10:00" },
					end: { local: "2026-07-17T11:00" },
				},
				consideredStopPlaces: [
					{ evaNo: "8000105", name: "Frankfurt (Main) Hbf" },
					{ evaNo: "8098105", name: "Frankfurt Hbf (tief)" },
				],
				truncatedTransportTypes: [],
			},
		});
	});

	test("reicht alle Filter an OpenBoards weiter", async () => {
		fetchMock.mockResolvedValue(json(board("arrivals", [])));

		await createClient().getArrivals({
			evaNo: "8000105",
			startTime: "2026-12-01T10:00",
			durationMinutes: 480,
			platforms: ["7"],
			transportTypes: ["CITY_TRAIN"],
			includeNearbyStops: false,
			maxEntriesPerTransportType: 5,
		});

		expect(fetchMock.mock.calls[0][0]).toBe("https://db.test/v1/arrivals");
		expect(body()).toMatchObject({
			stopPlaceOrStation: {
				evaNumbers: ["8000105"],
				platforms: ["7"],
				boardConfigurations: ["NONE"],
			},
			timeWindow: {
				timeStart: "2026-12-01T09:00:00.000Z",
				timeEnd: "2026-12-01T17:00:00.000Z",
			},
			transportTypes: ["CITY_TRAIN"],
			maxEntriesPerTransportType: 5,
		});
	});

	test("führt Ankünfte und Abfahrten zur Bahnhofstafel zusammen", async () => {
		fetchMock.mockImplementation(async (url) =>
			String(url).endsWith("/arrivals")
				? json(
						board("arrivals", [
							entry({ timeSchedule: "2026-07-17T10:15:00+02:00" }),
						]),
					)
				: json(
						board("departures", [entry()], {
							meta: { truncatedTransportTypes: ["REGIONAL_TRAIN"] },
						}),
					),
		);

		const result = await createClient().getStationBoard({ evaNo: "8000105" });

		expect(result.endpoint).toBe("/arrivals + /departures");
		expect(result.data.stops).toHaveLength(1);
		expect(result.data.stops[0]).toMatchObject({
			arrival: { delayMinutes: 12 },
			departure: { delayMinutes: 7, effective: { platform: "10" } },
		});
		expect(result.data.truncatedTransportTypes).toEqual(["REGIONAL_TRAIN"]);
	});

	test("bricht die Bahnhofstafel ab, wenn eine Hälfte fehlt", async () => {
		fetchMock.mockImplementation(async (url) =>
			String(url).endsWith("/arrivals")
				? json(board("arrivals", []))
				: json({}, 500),
		);

		await expect(
			createClient().getStationBoard({ evaNo: "8000105" }),
		).rejects.toMatchObject({ code: "API_ERROR" });
	});

	test("meldet fehlende Zugangsdaten vor einem Netzwerkaufruf", async () => {
		await expect(
			createClient(false).getDepartures({ evaNo: "8000105" }),
		).rejects.toMatchObject({ code: "AUTHENTICATION_ERROR" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test.each([
		[401, "AUTHENTICATION_ERROR"],
		[403, "AUTHENTICATION_ERROR"],
		[404, "RESOURCE_NOT_FOUND"],
		[429, "API_RATE_LIMIT"],
		[400, "API_ERROR"],
		[500, "API_ERROR"],
	])("übersetzt HTTP %i in %s", async (status, code) => {
		fetchMock.mockResolvedValue(json({}, status));

		await expect(
			createClient().getDepartures({ evaNo: "8000105" }),
		).rejects.toMatchObject({ code });
	});

	test("nennt bei 401 den Grund des API-Gateways", async () => {
		fetchMock.mockResolvedValue(
			json(
				{
					httpCode: "401",
					httpMessage: "Unauthorized",
					moreInformation:
						"Cannot find valid subscription for the incoming API request.",
				},
				401,
			),
		);
		await expect(
			createClient().getDepartures({ evaNo: "8000105" }),
		).rejects.toThrow("Cannot find valid subscription");
	});

	test("nennt den Fehlertext der DB, verträgt aber auch Text ohne JSON", async () => {
		fetchMock.mockResolvedValueOnce(
			json({ title: "Bad Request", detail: "evaNumber unknown" }, 400),
		);
		await expect(
			createClient().getDepartures({ evaNo: "8000105" }),
		).rejects.toThrow("HTTP 400 (Bad Request: evaNumber unknown)");

		fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 502 }));
		await expect(
			createClient().getDepartures({ evaNo: "8000105" }),
		).rejects.toThrow(/HTTP 502$/);
	});

	test("liest eine leere Tafel ohne Liste als null Halte", async () => {
		// Form der echten API: ohne Treffer fehlen departures und stopPlaces.
		const empty = {
			messages: {},
			meta: { consideredStopPlaces: ["270241", "8000448"] },
			stations: [
				{
					stada: "31",
					localizedNames: [{ language: "deu", name: "Ahrweiler" }],
				},
			],
		};
		fetchMock.mockImplementation(
			async () => new Response(JSON.stringify(empty)),
		);

		for (const method of [
			"getDepartures",
			"getArrivals",
			"getStationBoard",
		] as const) {
			const result = await createClient()[method]({ evaNo: "8000448" });
			expect(result.data.stops).toEqual([]);
			expect(result.data.station).toEqual({
				evaNo: "8000448",
				name: "Ahrweiler",
			});
		}
	});

	test("rät bei mehreren Stationen keinen Namen", async () => {
		fetchMock.mockResolvedValue(
			new Response(
				JSON.stringify({
					meta: { consideredStopPlaces: [] },
					stations: ["A", "B"].map((name) => ({
						localizedNames: [{ language: "deu", name }],
					})),
				}),
			),
		);
		const { data } = await createClient().getDepartures({ evaNo: "8000448" });
		expect(data.station).toEqual({ evaNo: "8000448" });
	});

	test.each([
		[
			"Liste mit falschem Typ",
			'{"departures":{},"meta":{"consideredStopPlaces":[]}}',
		],
		["kein JSON", "<html>"],
		["null", "null"],
		["fehlende Liste", "{}"],
		[
			"ungültige Zeit",
			JSON.stringify(board("departures", [entry({ time: "kaputt" })])),
		],
	])("weist unerwartete Antworten zurück: %s", async (_name, text) => {
		fetchMock.mockResolvedValue(new Response(text));

		await expect(
			createClient().getDepartures({ evaNo: "8000105" }),
		).rejects.toMatchObject({ code: "API_INVALID_RESPONSE" });
	});

	test.each([
		["TimeoutError", "API_TIMEOUT"],
		["TypeError", "API_UNAVAILABLE"],
	])("übersetzt %s in %s", async (name, code) => {
		fetchMock.mockRejectedValue(Object.assign(new Error("x"), { name }));

		await expect(
			createClient().getDepartures({ evaNo: "8000105" }),
		).rejects.toMatchObject({ code });
	});

	test.each([
		{ startTime: "2026-02-31T10:00" },
		{ durationMinutes: 0 },
		{ durationMinutes: 481 },
		{ durationMinutes: Number.NaN },
	])("weist ungültige Zeitfenster ab: %o", async (params) => {
		await expect(
			createClient().getDepartures({ evaNo: "8000105", ...params }),
		).rejects.toMatchObject({ code: "INVALID_INPUT" });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	test("sucht Bahnhöfe ohne Zugangsdaten und ohne Netzwerk", async () => {
		const result = await createClient(false).findStations({ pattern: "FF" });

		expect(fetchMock).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			source: "DB InfraGO OpenStation (NeTEx)",
			dataAsOf: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
			data: { stations: [{ evaNo: "8000105" }] },
		});
	});
});
