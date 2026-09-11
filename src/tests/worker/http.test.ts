import { describe, expect, test } from "vitest";
import type { Env } from "../../../worker/src/env.js";
import worker from "../../../worker/src/index.js";

/**
 * HTTP-Fassade: CORS, Preflight, Routing, Rate Limit.
 *
 * Der CORS-Test ist nur mit `Origin`-Header aussagekräftig — ohne Header
 * gäbe es nichts zu prüfen.
 */

const ALLOWED_ORIGIN = "https://jorekai.github.io";

const ENV: Env = {
	DB_TIMETABLE_CLIENT_ID: "test-client",
	DB_TIMETABLE_CLIENT_SECRET: "test-secret",
	ALLOWED_ORIGINS: ALLOWED_ORIGIN,
	ENVIRONMENT: "test",
};

function context(): ExecutionContext {
	return {
		waitUntil: () => {},
		passThroughOnException: () => {},
	} as unknown as ExecutionContext;
}

function call(
	path: string,
	init: RequestInit & { origin?: string; ip?: string } = {},
) {
	const { origin, ip, ...rest } = init;
	const headers = new Headers(rest.headers);
	if (origin) headers.set("Origin", origin);
	if (ip) headers.set("CF-Connecting-IP", ip);

	return worker.fetch(
		new Request(`https://worker.test${path}`, { ...rest, headers }),
		ENV,
		context(),
	);
}

describe("CORS", () => {
	test("Preflight von der erlaubten Origin liefert exakt diese Origin", async () => {
		const response = await call("/mcp", {
			method: "OPTIONS",
			origin: ALLOWED_ORIGIN,
		});

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			ALLOWED_ORIGIN,
		);
		expect(response.headers.get("Access-Control-Allow-Origin")).not.toBe("*");
		expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
			"Mcp-Session-Id",
		);
		expect(response.headers.get("Access-Control-Allow-Headers")).toContain(
			"Content-Type",
		);
	});

	test("Preflight von fremder Origin setzt gar kein Allow-Origin", async () => {
		const response = await call("/mcp", {
			method: "OPTIONS",
			origin: "https://evil.example",
		});

		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	test("erlaubte Origin wird auch an echten Antworten gespiegelt", async () => {
		const response = await call("/healthz", { origin: ALLOWED_ORIGIN });

		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			ALLOWED_ORIGIN,
		);
		expect(response.headers.get("Access-Control-Expose-Headers")).toContain(
			"X-MCP-Cache",
		);
		expect(response.headers.get("Vary")).toBe("Origin");
	});

	test("fremde Origin bekommt kein Allow-Origin", async () => {
		const response = await call("/healthz", {
			origin: "https://evil.example",
		});

		expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});
});

describe("Routing", () => {
	test("healthz meldet Name und Version", async () => {
		const response = await call("/healthz");
		const body = (await response.json()) as Record<string, unknown>;

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			ok: true,
			name: "DB Timetable MCP Server",
			version: "2.0.0",
		});
	});

	test("unbekannte Pfade nennen den MCP-Endpunkt", async () => {
		const response = await call("/api/board");
		const body = (await response.json()) as { error: { code: string } };

		expect(response.status).toBe(404);
		expect(body.error.code).toBe("NOT_FOUND");
	});

	test("GET auf /mcp wird abgelehnt: die Demo ist stateless", async () => {
		const response = await call("/mcp", { method: "GET" });
		const body = (await response.json()) as { error: { code: string } };

		expect(response.status).toBe(405);
		expect(body.error.code).toBe("METHOD_NOT_ALLOWED");
		expect(response.headers.get("Allow")).toBe("POST, OPTIONS");
	});

	test("ohne Bindings meldet der Worker fehlende Konfiguration", async () => {
		const response = await worker.fetch(
			new Request("https://worker.test/mcp", { method: "POST" }),
			{ ALLOWED_ORIGINS: ALLOWED_ORIGIN },
			context(),
		);
		const body = (await response.json()) as { error: { code: string } };

		expect(response.status).toBe(500);
		expect(body.error.code).toBe("CONFIGURATION_MISSING");
	});

	test("Rate Limit greift pro Client-IP", async () => {
		const ip = "203.0.113.77";
		let last = await call("/mcp", { method: "POST", ip });

		for (let i = 0; i < 20; i += 1) {
			last = await call("/mcp", { method: "POST", ip });
		}

		const body = (await last.json()) as { error: { code: string } };

		expect(last.status).toBe(429);
		expect(body.error.code).toBe("RATE_LIMITED");
		expect(last.headers.get("Retry-After")).toBeTruthy();
	});
});
