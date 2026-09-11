import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createCachedFetch, UpstreamLog } from "../../../worker/src/cache.js";
import {
	RateLimitError,
	UpstreamUnavailableError,
} from "../../../worker/src/errors.js";
import { resetBreaker } from "../../../worker/src/ratelimit.js";

/**
 * Verhalten der Cache-Schicht. Der wichtigste Nachweis steht in
 * „zwei identische Anfragen innerhalb der TTL": genau ein Upstream-Aufruf.
 */

const CACHE_ORIGIN = "https://worker.example";
const PREFIX =
	"https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1";

const PLAN_URL = `${PREFIX}/plan/8000105/260910/16`;
const LIVE_URL = `${PREFIX}/rchg/8000105`;

class FakeCache {
	private readonly store = new Map<string, Response>();

	async match(request: Request): Promise<Response | undefined> {
		return this.store.get(request.url)?.clone();
	}

	async put(request: Request, response: Response): Promise<void> {
		this.store.set(request.url, response.clone());
	}

	get size(): number {
		return this.store.size;
	}
}

function xml(body: string): Response {
	return new Response(body, { status: 200 });
}

describe("createCachedFetch", () => {
	let cache: FakeCache;
	let upstream: ReturnType<typeof vi.fn>;
	let log: UpstreamLog;

	beforeEach(() => {
		resetBreaker();
		cache = new FakeCache();
		log = new UpstreamLog();
		// Frische Response pro Aufruf: ein geteilter Body wäre beim zweiten
		// Lesen bereits verbraucht und würde den Upstream-Pfad verfälschen.
		upstream = vi.fn().mockImplementation(async () => xml("<timetable/>"));
		vi.stubGlobal("caches", { default: cache });
		vi.stubGlobal("fetch", upstream);
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-09-10T14:46:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	test("zwei identische Anfragen innerhalb der TTL lösen genau einen Upstream-Aufruf aus", async () => {
		const cachedFetch = createCachedFetch(CACHE_ORIGIN, log, undefined);

		await cachedFetch(PLAN_URL);
		await cachedFetch(PLAN_URL);

		expect(upstream).toHaveBeenCalledTimes(1);
		expect(log.upstreamCalls).toBe(1);
		expect(log.calls).toHaveLength(2);
		expect(log.calls[1]).toMatchObject({ cached: true, stale: false });
		expect(log.retrievedAt).toBe("2026-09-10T14:46:00.000Z");
	});

	test("nach Ablauf der Live-TTL wird wieder upgestreamt", async () => {
		const cachedFetch = createCachedFetch(CACHE_ORIGIN, log, undefined);

		await cachedFetch(LIVE_URL);
		vi.setSystemTime(new Date("2026-09-10T14:46:31.000Z"));
		await cachedFetch(LIVE_URL);

		expect(upstream).toHaveBeenCalledTimes(2);
		expect(log.calls[1]).toMatchObject({ cached: false, ttlSeconds: 30 });
	});

	test("die Plan-TTL hält eine Stunde", async () => {
		const cachedFetch = createCachedFetch(CACHE_ORIGIN, log, undefined);

		await cachedFetch(PLAN_URL);
		vi.setSystemTime(new Date("2026-09-10T15:45:00.000Z"));
		await cachedFetch(PLAN_URL);

		expect(upstream).toHaveBeenCalledTimes(1);

		vi.setSystemTime(new Date("2026-09-10T15:47:00.000Z"));
		await cachedFetch(PLAN_URL);

		expect(upstream).toHaveBeenCalledTimes(2);
	});

	test("bei Upstream-500 kommt der letzte Cache-Stand mit stale=true zurück", async () => {
		const cachedFetch = createCachedFetch(CACHE_ORIGIN, log, undefined);

		await cachedFetch(PLAN_URL);
		vi.setSystemTime(new Date("2026-09-10T15:47:00.000Z"));
		upstream.mockResolvedValue(new Response("boom", { status: 500 }));

		const response = await cachedFetch(PLAN_URL);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("<timetable/>");
		expect(log.stale).toBe(true);
		// Der Log sammelt beide Aufrufe: der erste war ein Miss, der zweite
		// bediente sich aus dem Cache.
		expect(log.calls.at(-1)).toMatchObject({ cached: true, stale: true });
		expect(log.upstreamCalls).toBe(1);
		// Der alte Stand bleibt erhalten; kein leerer Bildschirm.
		expect(log.retrievedAt).toBe("2026-09-10T14:46:00.000Z");
	});

	test("ohne Cache-Stand führt Upstream-500 zu einem stabilen Fehlercode", async () => {
		const cachedFetch = createCachedFetch(CACHE_ORIGIN, log, undefined);
		upstream.mockResolvedValue(new Response("boom", { status: 500 }));

		await expect(cachedFetch(PLAN_URL)).rejects.toBeInstanceOf(
			UpstreamUnavailableError,
		);
		await expect(cachedFetch(PLAN_URL)).rejects.toMatchObject({
			code: "UPSTREAM_UNAVAILABLE",
		});
	});

	test("ein Upstream-429 öffnet den Breaker und liefert den alten Stand", async () => {
		const cachedFetch = createCachedFetch(CACHE_ORIGIN, log, undefined);

		await cachedFetch(LIVE_URL);
		vi.setSystemTime(new Date("2026-09-10T14:46:31.000Z"));
		upstream.mockResolvedValue(new Response("quota", { status: 429 }));

		const response = await cachedFetch(LIVE_URL);

		expect(await response.text()).toBe("<timetable/>");
		expect(log.stale).toBe(true);

		// Breaker offen: ein anderer Pfad ohne Cache wird nicht mehr versucht.
		const callsBefore = upstream.mock.calls.length;
		await expect(cachedFetch(PLAN_URL)).rejects.toMatchObject({
			code: "UPSTREAM_UNAVAILABLE",
		});
		expect(upstream.mock.calls.length).toBe(callsBefore);
	});

	test("ohne Cache-Stand führt Upstream-429 zu RATE_LIMITED", async () => {
		const cachedFetch = createCachedFetch(CACHE_ORIGIN, log, undefined);
		upstream.mockResolvedValue(new Response("quota", { status: 429 }));

		const error = await cachedFetch(LIVE_URL).catch((cause) => cause);

		expect(error).toBeInstanceOf(RateLimitError);
		expect(error.code).toBe("RATE_LIMITED");
		expect(error.retryAfterSeconds).toBeGreaterThanOrEqual(1);
	});

	test("Credentials- und Autorisierungsfehler werden nicht als Cache-Treffer getarnt", async () => {
		const cachedFetch = createCachedFetch(CACHE_ORIGIN, log, undefined);
		upstream.mockResolvedValue(new Response("nope", { status: 401 }));

		await expect(cachedFetch(PLAN_URL)).rejects.toMatchObject({
			code: "UPSTREAM_AUTH_FAILED",
		});
	});

	test("Cache-Keys liegen in der Zone des Workers", async () => {
		const cachedFetch = createCachedFetch(CACHE_ORIGIN, log, undefined);

		await cachedFetch(PLAN_URL);
		await cachedFetch(PLAN_URL);

		expect(cache.size).toBe(1);
	});

	test("Simulation erzwingt einen Upstream-Fehler, ohne zu fetchen", async () => {
		const cachedFetch = createCachedFetch(CACHE_ORIGIN, log, undefined, "500");

		await expect(cachedFetch(PLAN_URL)).rejects.toMatchObject({
			code: "UPSTREAM_UNAVAILABLE",
		});
		expect(upstream).not.toHaveBeenCalled();
	});

	test("waitUntil wird für das Schreiben des Cache genutzt", async () => {
		const waitUntil = vi.fn();
		const ctx = { waitUntil } as unknown as ExecutionContext;
		const cachedFetch = createCachedFetch(CACHE_ORIGIN, log, ctx);

		await cachedFetch(PLAN_URL);

		expect(waitUntil).toHaveBeenCalledOnce();
	});
});
