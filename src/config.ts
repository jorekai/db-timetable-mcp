import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { SERVER_INFO } from "./serverInfo.js";

const DEFAULT_API_URL =
	"https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1";

const ConfigSchema = z.object({
	server: z.object({
		name: z.string(),
		version: z.string(),
		transport: z.enum(["stdio", "http"]),
		host: z.string().min(1),
		port: z.coerce.number().int().min(1).max(65_535),
		endpoint: z.string().startsWith("/"),
		allowedHosts: z.array(z.string().min(1)).optional(),
	}),
	api: z.object({
		baseUrl: z.string().url(),
		clientId: z.string(),
		clientSecret: z.string(),
		timeoutMs: z.coerce.number().int().min(1_000).max(120_000),
	}),
	logging: z.object({
		level: z.enum(["debug", "info", "warn", "error"]),
	}),
});

export type Config = z.infer<typeof ConfigSchema>;

function normalizeTransport(value?: string): "stdio" | "http" | string {
	if (value === "sse" || value === "httpStream") return "http";
	return value ?? "stdio";
}

function normalizeEndpoint(value?: string): string {
	const endpoint = value || "/mcp";
	return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
}

function parseAllowedHosts(value?: string): string[] | undefined {
	const hosts = value
		?.split(",")
		.map((host) => host.trim())
		.filter(Boolean);
	return hosts && hosts.length > 0 ? hosts : undefined;
}

export function createConfig(env: Record<string, string | undefined>): Config {
	const result = ConfigSchema.safeParse({
		server: {
			name: SERVER_INFO.name,
			version: SERVER_INFO.version,
			transport: normalizeTransport(env.MCP_TRANSPORT ?? env.TRANSPORT_TYPE),
			host: env.HOST ?? "127.0.0.1",
			port: env.PORT ?? "3000",
			endpoint: normalizeEndpoint(env.MCP_ENDPOINT ?? env.SSE_ENDPOINT),
			allowedHosts: parseAllowedHosts(env.ALLOWED_HOSTS),
		},
		api: {
			baseUrl: env.DB_TIMETABLE_BASE_URL ?? DEFAULT_API_URL,
			clientId:
				env.DB_TIMETABLE_CLIENT_ID ?? env.MCP_DB_TIMETABLE_CLIENT_ID ?? "",
			clientSecret:
				env.DB_TIMETABLE_CLIENT_SECRET ??
				env.MCP_DB_TIMETABLE_CLIENT_SECRET ??
				"",
			timeoutMs: env.DB_TIMETABLE_TIMEOUT_MS ?? "15000",
		},
		logging: { level: env.LOG_LEVEL ?? "info" },
	});

	if (!result.success) {
		const details = result.error.issues
			.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
			.join("; ");
		throw new Error(`Ungültige Server-Konfiguration: ${details}`);
	}
	if (
		["0.0.0.0", "::"].includes(result.data.server.host) &&
		!result.data.server.allowedHosts
	) {
		throw new Error(
			"Ungültige Server-Konfiguration: ALLOWED_HOSTS ist bei HOST=0.0.0.0 oder HOST=:: erforderlich",
		);
	}
	return result.data;
}

export function getEnvFilePaths(
	env: Record<string, string | undefined>,
	moduleUrl: string,
	cwd: string,
): string[] {
	if (env.DOTENV_CONFIG_PATH) return [env.DOTENV_CONFIG_PATH];
	const candidates = [
		path.resolve(cwd, ".env"),
		fileURLToPath(new URL("../.env", moduleUrl)),
	];
	return [...new Set(candidates)];
}
