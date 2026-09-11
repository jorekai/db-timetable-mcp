import { describe, expect, test } from "vitest";
import {
	cacheBucket,
	STALE_WINDOW_SECONDS,
	TTL_SECONDS,
	UpstreamLog,
} from "../../../worker/src/cache.js";

const MARKETPLACE_PREFIX = "/db-api-marketplace/apis/timetables/v1";

describe("cacheBucket", () => {
	test("Plan-Anfragen bekommen 1 Stunde TTL", () => {
		const bucket = cacheBucket(`${MARKETPLACE_PREFIX}/plan/8000105/260910/16`);

		expect(bucket.bucket).toBe("plan");
		expect(bucket.ttlSeconds).toBe(TTL_SECONDS.plan);
		expect(bucket.ttlSeconds).toBe(3600);
	});

	test("Stationsverzeichnis bekommt 24 Stunden TTL", () => {
		const bucket = cacheBucket(`${MARKETPLACE_PREFIX}/station/Frankfurt%20Hbf`);

		expect(bucket.bucket).toBe("station");
		expect(bucket.ttlSeconds).toBe(TTL_SECONDS.station);
		expect(bucket.ttlSeconds).toBe(86400);
	});

	test("Live-Endpunkte bekommen 30 Sekunden TTL", () => {
		for (const endpoint of ["/fchg/8000105", "/rchg/8000105"]) {
			const bucket = cacheBucket(`${MARKETPLACE_PREFIX}${endpoint}`);

			expect(bucket.bucket).toBe("live");
			expect(bucket.ttlSeconds).toBe(TTL_SECONDS.live);
			expect(bucket.ttlSeconds).toBe(30);
		}
	});

	test("erkennt den Endpunkt auch ohne Marketplace-Präfix", () => {
		// Regression: startsWith("/plan/") matchte nie, weil der echte Pfad
		// mit /db-api-marketplace/apis/timetables/v1/ beginnt.
		expect(cacheBucket("/plan/8000105/260910/16").bucket).toBe("plan");
		expect(cacheBucket("/station/Berlin").bucket).toBe("station");
	});

	test("das Veraltet-Fenster ist deutlich größer als jede frische TTL", () => {
		expect(STALE_WINDOW_SECONDS).toBeGreaterThan(TTL_SECONDS.plan);
	});
});

describe("UpstreamLog", () => {
	test("zählt nur echte Upstream-Aufrufe", () => {
		const log = new UpstreamLog();
		const base = { path: "/plan/x", ttlSeconds: 3600, fetchedAt: 1_000 };

		log.record({ ...base, cached: false, stale: false });
		log.record({ ...base, cached: true, stale: false });
		log.record({ ...base, cached: true, stale: false });

		expect(log.upstreamCalls).toBe(1);
		expect(log.calls).toHaveLength(3);
	});

	test("fromCache gilt nur, wenn jeder Aufruf aus dem Cache kam", () => {
		const log = new UpstreamLog();
		const base = { path: "/plan/x", ttlSeconds: 3600, fetchedAt: 1_000 };

		log.record({ ...base, cached: true, stale: false });
		expect(log.fromCache).toBe(true);

		log.record({ ...base, cached: false, stale: false });
		expect(log.fromCache).toBe(false);
	});

	test("stale ist gesetzt, sobald ein Wert veraltet ist", () => {
		const log = new UpstreamLog();
		const base = { path: "/fchg/x", ttlSeconds: 30, fetchedAt: 1_000 };

		log.record({ ...base, cached: true, stale: false });
		expect(log.stale).toBe(false);

		log.record({ ...base, cached: true, stale: true });
		expect(log.stale).toBe(true);
	});

	test("retrievedAt ist der älteste verwendete Datenstand", () => {
		const log = new UpstreamLog();

		log.record({
			path: "/plan/x",
			ttlSeconds: 3600,
			fetchedAt: Date.UTC(2026, 8, 10, 14, 46, 4),
			cached: true,
			stale: false,
		});
		log.record({
			path: "/rchg/x",
			ttlSeconds: 30,
			fetchedAt: Date.UTC(2026, 8, 10, 14, 46, 30),
			cached: false,
			stale: false,
		});

		expect(log.retrievedAt).toBe("2026-09-10T14:46:04.000Z");
	});

	test("leerer Log hat keinen Datenstand und kommt nicht aus dem Cache", () => {
		const log = new UpstreamLog();

		expect(log.retrievedAt).toBeNull();
		expect(log.fromCache).toBe(false);
		expect(log.stale).toBe(false);
		expect(log.upstreamCalls).toBe(0);
	});
});
