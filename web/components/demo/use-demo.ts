"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BOARD_SIZE, REFRESH_SECONDS, resolveEndpoint } from "@/lib/config";
import {
	type CacheMeta,
	McpClient,
	type McpLogEntry,
	ProtocolError,
	ThrottledError,
} from "@/lib/mcp";
import {
	berlinParts,
	buildDepartures,
	countArrivalOnly,
	type Departure,
} from "@/lib/timetable";
import type { Station, TimetableDocument, ToolDescriptor } from "@/lib/types";

export type DemoStatus =
	| { kind: "idle" }
	| { kind: "searching" }
	| { kind: "found"; count: number }
	| { kind: "noMatch" }
	| { kind: "loading"; name: string }
	| { kind: "ready" };

export type DemoError =
	| { kind: "rate"; seconds: number }
	| { kind: "upstream"; code: string; message: string }
	| { kind: "generic"; code: string; message: string };

export interface BoardState {
	station: Station;
	departures: Departure[];
	meta: CacheMeta;
	hiddenArrivals: number;
}

export interface DemoApi {
	endpoint: string;
	busy: boolean;
	status: DemoStatus;
	error: DemoError | null;
	stations: Station[];
	board: BoardState | null;
	logs: McpLogEntry[];
	tools: ToolDescriptor[];
	refreshEnabled: boolean;
	secondsLeft: number;
	stale: boolean;
	meta: CacheMeta;
	search: (pattern: string) => Promise<void>;
	openStation: (station: Station) => Promise<void>;
	refresh: () => Promise<void>;
	setRefreshEnabled: (enabled: boolean) => void;
}

export function useDemo(): DemoApi {
	const [logs, setLogs] = useState<McpLogEntry[]>([]);
	const [tools, setTools] = useState<ToolDescriptor[]>([]);

	const [client] = useState(
		() =>
			new McpClient({
				onLog: (entry: McpLogEntry) =>
					setLogs((previous) => [...previous, entry].slice(-60)),
				onTools: (tools: ToolDescriptor[]) => setTools(tools),
			}),
	);
	const [stations, setStations] = useState<Station[]>([]);
	const [board, setBoard] = useState<BoardState | null>(null);
	const [status, setStatus] = useState<DemoStatus>({ kind: "idle" });
	const [error, setError] = useState<DemoError | null>(null);
	const [busy, setBusy] = useState(false);
	const [refreshEnabled, setRefreshEnabled] = useState(true);
	const [secondsLeft, setSecondsLeft] = useState(REFRESH_SECONDS);
	const [meta, setMeta] = useState<CacheMeta>({
		cache: null,
		upstreamCalls: 0,
		stale: false,
		retrievedAt: null,
	});

	const stationRef = useRef<Station | null>(null);
	const lastLoadRef = useRef<number>(0);
	const loadRef = useRef<(station: Station) => Promise<void>>(async () => {});

	const loadBoard = useCallback(
		async (station: Station) => {
			stationRef.current = station;
			lastLoadRef.current = Date.now();
			setSecondsLeft(REFRESH_SECONDS);
			setBusy(true);
			setStatus({ kind: "loading", name: station.name });

			try {
				await client.ensureSession();
				const now = berlinParts(new Date());
				const { data, meta } = await client.callTool<TimetableDocument>(
					"getStationBoard",
					{
						evaNo: station.evaNo,
						date: `${now.yy}${now.mm}${now.dd}`,
						hour: now.hh,
					},
					`Tafel ${now.hh}:00`,
				);
				setMeta(meta);

				const stops = data.data?.stops ?? [];
				setBoard({
					station,
					departures: buildDepartures(stops).slice(0, BOARD_SIZE),
					meta,
					hiddenArrivals: countArrivalOnly(stops),
				});
				setStations([]);
				setError(null);
				setStatus({ kind: "ready" });
				if (meta.stale) setRefreshEnabled(false);
			} catch (caught) {
				if (caught instanceof ThrottledError) {
					setError({ kind: "rate", seconds: caught.retryAfterSeconds });
					setRefreshEnabled(false);
				} else if (caught instanceof ProtocolError) {
					const upstream =
						caught.code === "UPSTREAM_UNAVAILABLE" ||
						caught.code === "RATE_LIMITED";
					setError({
						kind: upstream ? "upstream" : "generic",
						code: caught.code,
						message: caught.message,
					});
				} else {
					setError({
						kind: "generic",
						code: "NETWORK",
						message: caught instanceof Error ? caught.message : String(caught),
					});
				}
				setStatus({ kind: "ready" });
			} finally {
				setBusy(false);
			}
		},
		[client],
	);

	loadRef.current = loadBoard;

	const search = useCallback(
		async (pattern: string) => {
			const trimmed = pattern.trim();
			if (!trimmed) return;
			setBusy(true);
			setError(null);
			setStations([]);
			setStatus({ kind: "searching" });

			try {
				await client.ensureSession();
				const { data, meta } = await client.callTool<Station[]>(
					"findStations",
					{ pattern: trimmed },
					`Suche "${trimmed}"`,
				);
				setMeta(meta);
				const list = Array.isArray(data.data) ? data.data : [];
				setStations(list);
				setStatus(
					list.length === 0
						? { kind: "noMatch" }
						: { kind: "found", count: list.length },
				);
			} catch (caught) {
				if (caught instanceof ThrottledError) {
					setError({ kind: "rate", seconds: caught.retryAfterSeconds });
				} else if (caught instanceof ProtocolError) {
					setError({
						kind:
							caught.code === "UPSTREAM_UNAVAILABLE" ? "upstream" : "generic",
						code: caught.code,
						message: caught.message,
					});
				} else {
					setError({
						kind: "generic",
						code: "NETWORK",
						message: caught instanceof Error ? caught.message : String(caught),
					});
				}
				setStatus({ kind: "idle" });
			} finally {
				setBusy(false);
			}
		},
		[client],
	);

	const openStation = useCallback(
		async (station: Station) => {
			await loadBoard(station);
		},
		[loadBoard],
	);

	const refresh = useCallback(async () => {
		const station = stationRef.current;
		if (station) await loadBoard(station);
	}, [loadBoard]);

	// Sichtbarer Countdown und Auto-Aktualisierung. Intervall nie unter der
	// Live-TTL von 30 s, sonst wird das DB-Kontingent verschwendet.
	useEffect(() => {
		if (!board || !refreshEnabled) return;
		const station = board.station;
		const tick = setInterval(() => {
			const elapsed = Date.now() - lastLoadRef.current;
			const remaining = REFRESH_SECONDS - Math.floor(elapsed / 1000);
			setSecondsLeft(Math.max(0, remaining));
			if (remaining <= 0) {
				lastLoadRef.current = Date.now();
				void loadRef.current(station);
			}
		}, 250);
		return () => clearInterval(tick);
	}, [board, refreshEnabled]);

	return {
		endpoint: resolveEndpoint(),
		busy,
		status,
		error,
		stations,
		board,
		logs,
		tools,
		meta,
		refreshEnabled,
		secondsLeft,
		stale: board?.meta.stale ?? false,
		search,
		openStation,
		refresh,
		setRefreshEnabled,
	};
}
