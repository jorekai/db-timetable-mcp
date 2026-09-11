import { beforeEach, describe, expect, test } from "vitest";
import {
	checkRateLimit,
	isBreakerOpen,
	LIMIT_PER_HOUR,
	LIMIT_PER_MINUTE,
	resetBreaker,
	tripBreaker,
} from "../../../worker/src/ratelimit.js";

describe("checkRateLimit", () => {
	// Jeder Test nutzt einen eigenen Client-Key: der Zähler liegt im
	// Modulspeicher und überlebt einzelne Tests.
	let clientCounter = 0;
	let client: string;

	beforeEach(() => {
		clientCounter += 1;
		client = `test-client-${clientCounter}`;
	});

	test(`erlaubt ${LIMIT_PER_MINUTE} Anfragen pro Minute`, () => {
		const now = 1_000_000;

		for (let i = 0; i < LIMIT_PER_MINUTE; i += 1) {
			expect(checkRateLimit(client, now).allowed).toBe(true);
		}
	});

	test("blockt die Anfrage über dem Minutenlimit", () => {
		const now = 1_000_000;

		for (let i = 0; i < LIMIT_PER_MINUTE; i += 1) {
			checkRateLimit(client, now);
		}
		const blocked = checkRateLimit(client, now);

		expect(blocked.allowed).toBe(false);
		expect(blocked.window).toBe("minute");
		expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
	});

	test("erlaubt nach Ablauf des Minutenfensters wieder", () => {
		const now = 1_000_000;

		for (let i = 0; i < LIMIT_PER_MINUTE; i += 1) {
			checkRateLimit(client, now);
		}
		expect(checkRateLimit(client, now).allowed).toBe(false);

		expect(checkRateLimit(client, now + 60_001).allowed).toBe(true);
	});

	test("greift zusätzlich das Stundenlimit", () => {
		// 11 Minuten a 20 Anfragen = 220 > 200.
		for (let minute = 0; minute < 11; minute += 1) {
			for (let i = 0; i < LIMIT_PER_MINUTE; i += 1) {
				checkRateLimit(client, 1_000_000 + minute * 60_001);
			}
		}

		const blocked = checkRateLimit(client, 1_000_000 + 10 * 60_001);
		expect(blocked.allowed).toBe(false);
		expect(blocked.window).toBe("hour");
		expect(LIMIT_PER_HOUR).toBe(200);
	});

	test("verschiedene Clients stören sich nicht", () => {
		const now = 1_000_000;

		for (let i = 0; i < LIMIT_PER_MINUTE; i += 1) {
			checkRateLimit("client-a", now);
		}
		expect(checkRateLimit("client-a", now).allowed).toBe(false);
		expect(checkRateLimit("client-b", now).allowed).toBe(true);
	});
});

describe("Circuit Breaker", () => {
	beforeEach(() => {
		resetBreaker();
	});

	test("ist anfangs geschlossen", () => {
		expect(isBreakerOpen(1_000)).toBe(false);
	});

	test("öffnet nach einem Upstream-429 für 30 Sekunden", () => {
		tripBreaker(1_000);

		expect(isBreakerOpen(1_000)).toBe(true);
		expect(isBreakerOpen(30_999)).toBe(true);
		expect(isBreakerOpen(31_001)).toBe(false);
	});

	test("verlängert sich nicht rückwärts", () => {
		tripBreaker(10_000);
		tripBreaker(5_000);

		expect(isBreakerOpen(39_000)).toBe(true);
	});

	test("resetBreaker schließt ihn wieder", () => {
		tripBreaker(1_000);
		resetBreaker();

		expect(isBreakerOpen(1_000)).toBe(false);
	});
});
