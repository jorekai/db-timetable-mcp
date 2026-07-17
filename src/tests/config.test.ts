import { describe, expect, test } from "vitest";
import { createConfig, getEnvFilePaths } from "../config.js";

describe("Konfiguration", () => {
	test("verwendet sichere Standards für lokalen stdio-Betrieb", () => {
		const config = createConfig({});

		expect(config.server).toMatchObject({
			transport: "stdio",
			host: "127.0.0.1",
			port: 3000,
			endpoint: "/mcp",
		});
		expect(config.logging.level).toBe("info");
	});

	test("unterstützt neue Variablen und normalisiert Listen", () => {
		const config = createConfig({
			MCP_TRANSPORT: "http",
			HOST: "0.0.0.0",
			PORT: "8080",
			MCP_ENDPOINT: "rail",
			ALLOWED_HOSTS: "mcp.example.com, localhost ",
			LOG_LEVEL: "debug",
			DB_TIMETABLE_CLIENT_ID: "client-id",
			DB_TIMETABLE_CLIENT_SECRET: "client-secret",
		});

		expect(config.server).toMatchObject({
			transport: "http",
			host: "0.0.0.0",
			port: 8080,
			endpoint: "/rail",
			allowedHosts: ["mcp.example.com", "localhost"],
		});
		expect(config.api).toMatchObject({
			clientId: "client-id",
			clientSecret: "client-secret",
		});
	});

	test("übersetzt alte SSE-Konfiguration auf Streamable HTTP", () => {
		const config = createConfig({
			TRANSPORT_TYPE: "sse",
			SSE_ENDPOINT: "/legacy",
		});

		expect(config.server.transport).toBe("http");
		expect(config.server.endpoint).toBe("/legacy");
	});

	test("weist ungültige Ports früh zurück", () => {
		expect(() => createConfig({ PORT: "70000" })).toThrow(
			"Ungültige Server-Konfiguration",
		);
	});

	test("verlangt bei öffentlicher Bindung eine Host-Allowlist", () => {
		expect(() => createConfig({ HOST: "0.0.0.0" })).toThrow("ALLOWED_HOSTS");
	});

	test("sucht .env sowohl im Arbeitsverzeichnis als auch neben dist", () => {
		const paths = getEnvFilePaths(
			{},
			"file:///project/dist/config.js",
			"/launcher-directory",
		);

		expect(paths).toEqual(["/launcher-directory/.env", "/project/.env"]);
	});

	test("respektiert einen expliziten .env-Pfad", () => {
		expect(
			getEnvFilePaths(
				{ DOTENV_CONFIG_PATH: "/secure/db.env" },
				"file:///project/dist/config.js",
				"/launcher-directory",
			),
		).toEqual(["/secure/db.env"]);
	});
});
