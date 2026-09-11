/*
 * MCP-Client für den Browser: rohes JSON-RPC 2.0 über den Streamable-HTTP-
 * Transport, gegen den Worker. Keine REST-Hülle, kein Proxy. Jede Nachricht
 * wird protokolliert, damit das Protokoll-Panel sie im Original zeigen kann.
 */

import {
	CLIENT_INFO,
	PROTOCOL_VERSION,
	resolveEndpoint,
	resolveSimulation,
} from "./config";
import type { ApiPayload, ToolDescriptor } from "./types";

export type Direction = "out" | "in";

export interface McpLogEntry {
	seq: number;
	direction: Direction;
	method: string;
	note?: string;
	payload: unknown;
	at: number;
	/** Ursprüngliche Größe in Bytes, nur gesetzt wenn gekürzt wurde. */
	bytes?: number;
	trimmed?: boolean;
}

export interface CacheMeta {
	cache: "hit" | "miss" | null;
	upstreamCalls: number;
	stale: boolean;
	retrievedAt: string | null;
}

export class ThrottledError extends Error {
	readonly retryAfterSeconds: number;
	constructor(message: string, retryAfterSeconds: number) {
		super(message);
		this.name = "ThrottledError";
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

export class ProtocolError extends Error {
	readonly code: string;
	constructor(code: string, message: string) {
		super(message);
		this.name = "ProtocolError";
		this.code = code;
	}
}

export interface McpClientOptions {
	onLog?: (entry: McpLogEntry) => void;
	onTools?: (tools: ToolDescriptor[]) => void;
}

/**
 * Protokolleinträge werden im Speicher gehalten. `getStationBoard` liefert
 * zweistellige Megabyte pro Aufruf, deshalb werden große Nutzlasten beim
 * Protokollieren gekürzt: Strings und Arrays werden begrenzt, die Struktur
 * bleibt sichtbar. In der UI wird die Kürzung ausdrücklich benannt.
 */
const LOG_BYTE_LIMIT = 60_000;
const LOG_STRING_LIMIT = 1200;
const LOG_ARRAY_LIMIT = 5;

function trimPayload(value: unknown, state: { trimmed: boolean }): unknown {
	if (typeof value === "string") {
		if (value.length > LOG_STRING_LIMIT) {
			state.trimmed = true;
			return `${value.slice(0, LOG_STRING_LIMIT)}… (+${value.length - LOG_STRING_LIMIT} chars)`;
		}
		return value;
	}
	if (Array.isArray(value)) {
		if (value.length > LOG_ARRAY_LIMIT) {
			state.trimmed = true;
			return [
				...value
					.slice(0, LOG_ARRAY_LIMIT)
					.map((item) => trimPayload(item, state)),
				`… (+${value.length - LOG_ARRAY_LIMIT} more items)`,
			];
		}
		return value.map((item) => trimPayload(item, state));
	}
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) {
			out[key] = trimPayload(entry, state);
		}
		return out;
	}
	return value;
}

/** Streamable HTTP darf mit JSON oder mit einem SSE-Stream antworten. */
function parseBody(text: string, contentType: string): unknown {
	if (!text) return null;
	if (contentType.includes("text/event-stream")) {
		let last: unknown = null;
		for (const line of text.split("\n")) {
			if (!line.startsWith("data:")) continue;
			const data = line.slice(5).trim();
			if (!data) continue;
			try {
				last = JSON.parse(data);
			} catch {
				// Nicht-JSON-Keepalive-Frames ignorieren.
			}
		}
		return last;
	}
	return JSON.parse(text);
}

export class McpClient {
	private readonly endpoint: string;
	private readonly simulation: string | null;
	private seq = 0;
	private nextId = 1;
	private initialized = false;
	private negotiatedVersion = PROTOCOL_VERSION;

	lastMeta: CacheMeta = {
		cache: null,
		upstreamCalls: 0,
		stale: false,
		retrievedAt: null,
	};

	constructor(private readonly options: McpClientOptions = {}) {
		this.endpoint = resolveEndpoint();
		this.simulation = resolveSimulation();
	}

	get endpointUrl(): string {
		return this.endpoint;
	}

	get protocolVersion(): string {
		return this.negotiatedVersion;
	}

	private log(
		direction: Direction,
		method: string,
		payload: unknown,
		note?: string,
	): void {
		this.seq += 1;
		let value = payload;
		let bytes: number | undefined;
		let trimmed = false;
		try {
			const json = JSON.stringify(payload);
			bytes = json.length;
			if (json.length > LOG_BYTE_LIMIT) {
				const state = { trimmed: false };
				value = trimPayload(payload, state);
				trimmed = state.trimmed;
			}
		} catch {
			// Nicht serialisierbare Nutzlast unverändert protokollieren.
		}
		this.options.onLog?.({
			seq: this.seq,
			direction,
			method,
			note,
			payload: value,
			at: Date.now(),
			bytes: trimmed ? bytes : undefined,
			trimmed,
		});
	}

	private async post(
		body: Record<string, unknown>,
		note?: string,
	): Promise<Record<string, unknown> | null> {
		const method = typeof body.method === "string" ? body.method : "-";
		this.log("out", method, body, note);

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			"MCP-Protocol-Version": this.negotiatedVersion,
		};
		if (this.simulation) {
			headers["X-Simulate-Upstream-Error"] = this.simulation;
		}

		const response = await fetch(this.endpoint, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
		});

		const text = await response.text();
		const contentType = response.headers.get("content-type") ?? "";

		const cacheState = response.headers.get("x-mcp-cache");
		this.lastMeta = {
			cache: cacheState === null ? null : cacheState === "hit" ? "hit" : "miss",
			upstreamCalls: Number(
				response.headers.get("x-mcp-upstream-calls") ?? "0",
			),
			stale: response.headers.get("x-mcp-cache-stale") === "true",
			retrievedAt: response.headers.get("x-mcp-retrieved-at"),
		};

		if (response.status === 429) {
			const retryAfter = Number(response.headers.get("retry-after") ?? "60");
			this.log(
				"in",
				method,
				{ httpStatus: 429, retryAfterSeconds: retryAfter },
				"Rate-Limit",
			);
			throw new ThrottledError("Rate limited", retryAfter);
		}

		if (!response.ok) {
			let parsed: unknown = null;
			try {
				parsed = parseBody(text, contentType);
			} catch {
				parsed = null;
			}
			const shaped = parsed as {
				error?: { code?: string; message?: string };
			} | null;
			const code = shaped?.error?.code ?? `HTTP_${response.status}`;
			const message =
				shaped?.error?.message ?? "Der Worker hat die Anfrage abgelehnt.";
			this.log("in", method, parsed ?? { httpStatus: response.status }, code);
			throw new ProtocolError(code, message);
		}

		if (!text) {
			this.log("in", method, { httpStatus: response.status }, "accepted");
			return null;
		}

		const parsed = parseBody(text, contentType) as Record<
			string,
			unknown
		> | null;
		this.log(
			"in",
			method,
			parsed,
			parsed && "error" in parsed ? "JSON-RPC-Fehler" : undefined,
		);
		return parsed;
	}

	private async rpc(
		method: string,
		params?: unknown,
		note?: string,
	): Promise<Record<string, unknown> | undefined> {
		const id = this.nextId;
		this.nextId += 1;
		const response = await this.post(
			{ jsonrpc: "2.0", id, method, params },
			note,
		);

		const error = response?.error as
			| { code?: string | number; message?: string }
			| undefined;
		if (error) {
			throw new ProtocolError(
				String(error.code ?? "RPC_ERROR"),
				error.message ?? "Der Server hat einen JSON-RPC-Fehler geliefert.",
			);
		}
		if (response?.id !== id) {
			throw new ProtocolError(
				"ID_MISMATCH",
				"Die Antwort-ID passt nicht zur Anfrage.",
			);
		}
		return response.result as Record<string, unknown> | undefined;
	}

	private async notify(method: string, params?: unknown): Promise<void> {
		await this.post({ jsonrpc: "2.0", method, params });
	}

	/** initialize → notifications/initialized → tools/list, einmal pro Seite. */
	async ensureSession(): Promise<void> {
		if (this.initialized) return;

		const result = await this.rpc("initialize", {
			protocolVersion: PROTOCOL_VERSION,
			capabilities: {},
			clientInfo: CLIENT_INFO,
		});

		const version = result?.protocolVersion;
		if (typeof version === "string") this.negotiatedVersion = version;

		await this.notify("notifications/initialized", {});

		const list = await this.rpc("tools/list", {});
		const tools = (list?.tools as ToolDescriptor[] | undefined) ?? [];
		this.options.onTools?.(tools);

		this.initialized = true;
	}

	async callTool<T>(
		name: string,
		args: Record<string, unknown>,
		note?: string,
	): Promise<{ data: ApiPayload<T>; meta: CacheMeta }> {
		const result = await this.rpc(
			"tools/call",
			{ name, arguments: args },
			note,
		);
		const meta: CacheMeta = { ...this.lastMeta };

		// Fehlgeschlagene Aufrufe tragen den Fehler nur im Text, nicht in
		// structuredContent. Deshalb erst structuredContent, dann content parsen.
		let payload = result?.structuredContent as ApiPayload<T> | undefined;
		if (!payload) {
			const content = result?.content as
				| Array<{ type?: string; text?: string }>
				| undefined;
			try {
				payload = JSON.parse(content?.[0]?.text ?? "null") as ApiPayload<T>;
			} catch {
				payload = undefined;
			}
		}

		if (result?.isError) {
			const failed = payload as unknown as
				| { error?: { code?: string; message?: string } }
				| undefined;
			throw new ProtocolError(
				failed?.error?.code ?? "TOOL_ERROR",
				failed?.error?.message ?? "Der Werkzeugaufruf ist fehlgeschlagen.",
			);
		}

		if (!payload) {
			throw new ProtocolError(
				"EMPTY_RESULT",
				"Die Antwort enthielt weder structuredContent noch parsebaren Text.",
			);
		}

		return { data: payload, meta };
	}
}
