/**
 * Best-Effort-Rate-Limit und globaler Circuit Breaker.
 *
 * Grenze der Umsetzung, ehrlich benannt: Der Zähler lebt im Speicher eines
 * Isolates. Cloudflare startet weltweit viele Isolate, der wirksame Grenzwert
 * ist deshalb `Limit × Anzahl aktiver Isolate`; Kaltstarts und Deployments
 * setzen ihn zurück. Das Free Tier hat kein fertiges Rate-Limiting-Produkt,
 * ein Durable Object wäre die korrekte Lösung und ist laut Auftrag
 * ausgeschlossen.
 *
 * Schutz gegen das Verbrennen des Upstream-Kontingents leistet primär der
 * Cache (worker/src/cache.ts) plus der globale Breaker auf ein Upstream-429.
 */

export interface RateLimitResult {
	allowed: boolean;
	/** Sekunden bis zum nächsten erlaubten Aufruf (nur wenn !allowed). */
	retryAfterSeconds: number;
	limit: number;
	window: "minute" | "hour";
}

export const LIMIT_PER_MINUTE = 20;
export const LIMIT_PER_HOUR = 200;

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const MAX_TRACKED_CLIENTS = 20_000;

const buckets = new Map<string, number[]>();

export function checkRateLimit(
	clientKey: string,
	now = Date.now(),
): RateLimitResult {
	const recent = (buckets.get(clientKey) ?? []).filter(
		(stamp) => now - stamp < HOUR_MS,
	);

	const inLastMinute = recent.filter((stamp) => now - stamp < MINUTE_MS).length;

	let result: RateLimitResult = {
		allowed: true,
		retryAfterSeconds: 0,
		limit: LIMIT_PER_MINUTE,
		window: "minute",
	};

	if (inLastMinute >= LIMIT_PER_MINUTE) {
		const oldestInMinute =
			recent.find((stamp) => now - stamp < MINUTE_MS) ?? now;
		result = {
			allowed: false,
			retryAfterSeconds: Math.max(
				1,
				Math.ceil((oldestInMinute + MINUTE_MS - now) / 1000),
			),
			limit: LIMIT_PER_MINUTE,
			window: "minute",
		};
	} else if (recent.length >= LIMIT_PER_HOUR) {
		const oldest = recent[0] ?? now;
		result = {
			allowed: false,
			retryAfterSeconds: Math.max(
				1,
				Math.ceil((oldest + HOUR_MS - now) / 1000),
			),
			limit: LIMIT_PER_HOUR,
			window: "hour",
		};
	}

	if (result.allowed) {
		recent.push(now);
		buckets.set(clientKey, recent);
		if (buckets.size > MAX_TRACKED_CLIENTS) {
			const oldestKeys = [...buckets.keys()].slice(0, 1000);
			for (const key of oldestKeys) buckets.delete(key);
		}
	}

	return result;
}

/**
 * Globaler Breaker: solange offen, wird kein Upstream-Aufruf mehr versucht.
 * Ausgelöst durch ein Upstream-429 — das Signal, dass das persönliche
 * Kontingent (laut Marketplace 60 Aufrufe/Minute) erschöpft ist.
 */
const BREAKER_MS = 30_000;
let breakerOpenUntil = 0;

export function isBreakerOpen(now = Date.now()): boolean {
	return now < breakerOpenUntil;
}

export function tripBreaker(now = Date.now(), durationMs = BREAKER_MS): void {
	breakerOpenUntil = Math.max(breakerOpenUntil, now + durationMs);
}

export function resetBreaker(): void {
	breakerOpenUntil = 0;
}

/** Nur für Tests: setzt die IP-Buckets zurück. */
export function resetRateLimit(): void {
	buckets.clear();
}
