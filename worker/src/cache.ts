import { CACHE_PATH_PREFIX, UPSTREAM_TIMEOUT_MS } from "./env.js";
import { RateLimitError, UpstreamUnavailableError } from "./errors.js";
import { isBreakerOpen, tripBreaker } from "./ratelimit.js";

/**
 * Cache- und Schutzschicht vor der DB-API.
 *
 * Gecacht wird der Upstream-Aufruf, nicht die Antwort an den Browser. Damit
 * kosten 10.000 Besucher auf derselben Bahnhofstafel innerhalb der TTL genau
 * einen Aufruf des persönlichen DB-Kontingents (laut Marketplace 60/Minute).
 */

/** TTL laut Auftrag: Live-Daten 30 s, Plan 1 h, Stationsverzeichnis 24 h. */
export const TTL_SECONDS = {
	live: 30,
	plan: 3600,
	station: 86400,
} as const;

/**
 * Wie lange ein Eintrag über die frische TTL hinaus im Cache bleibt, um bei
 * erschöpftem Kontingent noch als veralteter Stand ausgeliefert zu werden.
 * 6 h deckt den laufenden Betriebstag ab.
 */
export const STALE_WINDOW_SECONDS = 6 * 3600;

export interface UpstreamCall {
	/** Pfad des Upstream-Aufrufs, z.B. "/plan/8000105/260910/14". */
	path: string;
	ttlSeconds: number;
	/** Zeitpunkt, zu dem die gelieferten Daten vom Upstream geholt wurden. */
	fetchedAt: number;
	/** true, wenn aus dem Cache bedient wurde. */
	cached: boolean;
	/** true, wenn nur ein veralteter Cache-Stand vorlag. */
	stale: boolean;
}

/**
 * Sammelt pro Anfrage, welcher Upstream-Aufruf wann und ob aus dem Cache
 * bedient wurde. Dient dem Frontend als Herkunftshinweis und als Zähler für
 * den Nachweis, dass die TTL greift.
 */
export class UpstreamLog {
	readonly calls: UpstreamCall[] = [];
	upstreamCalls = 0;

	record(call: UpstreamCall): void {
		this.calls.push(call);
		if (!call.cached) this.upstreamCalls += 1;
	}

	/** Ältester Datenstand der Anfrage, ISO 8601. */
	get retrievedAt(): string | null {
		if (this.calls.length === 0) return null;
		const oldest = Math.min(...this.calls.map((call) => call.fetchedAt));
		return new Date(oldest).toISOString();
	}

	get fromCache(): boolean {
		return this.calls.length > 0 && this.calls.every((call) => call.cached);
	}

	get stale(): boolean {
		return this.calls.some((call) => call.stale);
	}
}

interface CacheEntry {
	fetchedAt: number;
	body: string;
}

/**
 * Schneidet das Marketplace-Präfix ab, damit die Endpunkt-Erkennung greift.
 * Die Aufruf-URL lautet
 * /db-api-marketplace/apis/timetables/v1/plan/...
 */
function apiEndpoint(pathname: string): string {
	const marker = "/timetables/v1";
	const index = pathname.indexOf(marker);
	return index >= 0 ? pathname.slice(index + marker.length) : pathname;
}

export function cacheBucket(path: string): {
	bucket: keyof typeof TTL_SECONDS;
	ttlSeconds: number;
} {
	const endpoint = apiEndpoint(path);
	if (endpoint.startsWith("/plan/")) {
		return { bucket: "plan", ttlSeconds: TTL_SECONDS.plan };
	}
	if (endpoint.startsWith("/station/")) {
		return { bucket: "station", ttlSeconds: TTL_SECONDS.station };
	}
	return { bucket: "live", ttlSeconds: TTL_SECONDS.live };
}

function inputUrl(input: RequestInfo | URL): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.href;
	return input.url;
}

/** Der DB-API-Client liefert XML; der Cache speichert genau diesen Body. */
function xmlResponse(body: string): Response {
	return new Response(body, {
		status: 200,
		headers: { "Content-Type": "application/xml" },
	});
}

/**
 * Der Upstream-Aufruf selbst. Liefert die rohe Response zurück, damit die
 * Cache-Schicht den Statuscode auswerten kann.
 */
async function callUpstream(
	url: string,
	init: RequestInit | undefined,
	simulation: string | null,
): Promise<Response> {
	if (simulation) {
		if (simulation === "network") {
			throw new UpstreamUnavailableError(
				"UPSTREAM_UNAVAILABLE",
				"The DB API is unreachable right now.",
			);
		}
		const status = Number.parseInt(simulation, 10);
		return new Response("simulated", {
			status: Number.isFinite(status) ? status : 503,
			statusText: "Simulated",
		});
	}

	return fetch(url, {
		method: init?.method ?? "GET",
		headers: init?.headers,
		// Der API-Client setzt bereits `AbortSignal.timeout(config.timeoutMs)`.
		signal: init?.signal ?? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
	});
}

/**
 * Baut eine `fetch`-Implementierung, die den API-Client mit Cache, Breaker und
 * Veraltet-Fallback versorgt. Passt unverändert in
 * `new TimetableApiClient(config, createCachedFetch(...))`.
 *
 * @param cacheOrigin Origin des eingehenden Worker-Requests. Cache-Keys müssen
 *   in derselben Zone liegen wie der Worker.
 * @param simulation Nur mit ALLOW_SIMULATION=1 gesetzt: "429", "500" oder
 *   "network". Erzwingt einen Upstream-Fehler, um den Veraltet-Fallback zu
 *   prüfen.
 */
export function createCachedFetch(
	cacheOrigin: string,
	log: UpstreamLog,
	ctx: ExecutionContext | undefined,
	simulation: string | null = null,
): typeof fetch {
	return async (input, init) => {
		const url = inputUrl(input);
		const parsed = new URL(url);
		const path = `${parsed.pathname}${parsed.search}`;
		const { ttlSeconds } = cacheBucket(parsed.pathname);
		const now = Date.now();

		const cacheKey = new Request(`${cacheOrigin}${CACHE_PATH_PREFIX}${path}`, {
			method: "GET",
		});

		const hit = await caches.default.match(cacheKey);
		const entry = hit ? ((await hit.json()) as CacheEntry) : null;

		if (entry && now - entry.fetchedAt < ttlSeconds * 1000) {
			log.record({
				path,
				ttlSeconds,
				fetchedAt: entry.fetchedAt,
				cached: true,
				stale: false,
			});
			return xmlResponse(entry.body);
		}

		// Offener Breaker: kein Upstream-Versuch, nur der alte Stand.
		if (isBreakerOpen(now)) {
			if (entry) {
				log.record({
					path,
					ttlSeconds,
					fetchedAt: entry.fetchedAt,
					cached: true,
					stale: true,
				});
				return xmlResponse(entry.body);
			}
			throw new UpstreamUnavailableError(
				"UPSTREAM_UNAVAILABLE",
				"The DB API quota is exhausted and no cached snapshot exists.",
			);
		}

		try {
			const response = await callUpstream(url, init, simulation);

			if (!response.ok) {
				if (response.status === 429) {
					tripBreaker(now);
					if (entry) {
						log.record({
							path,
							ttlSeconds,
							fetchedAt: entry.fetchedAt,
							cached: true,
							stale: true,
						});
						return xmlResponse(entry.body);
					}
					throw new RateLimitError(
						"The DB API quota for this demo is exhausted right now.",
						30,
					);
				}
				if (response.status >= 500) {
					throw new UpstreamUnavailableError(
						"UPSTREAM_UNAVAILABLE",
						"The DB API is unreachable right now.",
					);
				}
				if (response.status === 401 || response.status === 403) {
					throw new UpstreamUnavailableError(
						"UPSTREAM_AUTH_FAILED",
						"The worker is not authorised for the DB API.",
					);
				}
				throw new UpstreamUnavailableError(
					"UPSTREAM_ERROR",
					"The DB API rejected the request.",
				);
			}

			const body = await response.text();
			const fetchedAt = Date.now();

			const stored = new Response(
				JSON.stringify({ fetchedAt, body } satisfies CacheEntry),
				{
					headers: {
						"Content-Type": "application/json",
						// Der Cache API ist s-maxage egal; die TTL steuert der
						// Vergleich oben. Der Header dient nur der Lesbarkeit.
						"Cache-Control": `public, s-maxage=${STALE_WINDOW_SECONDS}`,
					},
				},
			);

			const put = caches.default.put(cacheKey, stored);
			if (ctx?.waitUntil) {
				ctx.waitUntil(put);
			} else {
				await put;
			}

			log.record({ path, ttlSeconds, fetchedAt, cached: false, stale: false });
			// Zähler für den Nachweis, dass die TTL greift: eine Zeile pro
			// tatsächlichem Upstream-Aufruf. Keine Zugangsdaten, nur der Pfad.
			console.log(JSON.stringify({ event: "upstream_call", path, ttlSeconds }));

			return new Response(body, {
				status: 200,
				headers: { "Content-Type": "application/xml" },
			});
		} catch (error) {
			// Jeder Fehler nach dem Upstream-Versuch: der letzte Stand ist
			// besser als ein leerer Bildschirm.
			if (entry && !(error instanceof RateLimitError)) {
				log.record({
					path,
					ttlSeconds,
					fetchedAt: entry.fetchedAt,
					cached: true,
					stale: true,
				});
				return xmlResponse(entry.body);
			}
			throw error;
		}
	};
}
