import { STATION_DATA_AS_OF } from "../stations/stationIndex.js";
import { searchStations } from "../stations/stationSearch.js";
import { parseBerlinTime, toTimestamp } from "../utils/berlinTime.js";
import {
	ApiError,
	AppError,
	AuthenticationError,
	InvalidInputError,
	ResourceNotFoundError,
} from "../utils/errorHandling.js";
import {
	type EventKind,
	mapStopRefs,
	mapStops,
	mergeStops,
	soleStationName,
} from "./boardMapper.js";
import type { RawBoard } from "./openBoards.js";
import type {
	ApiResult,
	Board,
	BoardParams,
	BoardStop,
	StationParams,
	StationSearchResult,
} from "./types.js";

export interface TimetableApiConfig {
	baseUrl: string;
	clientId: string;
	clientSecret: string;
	timeoutMs: number;
}

export interface TimetableApi {
	getStationBoard(params: BoardParams): Promise<ApiResult<Board>>;
	getDepartures(params: BoardParams): Promise<ApiResult<Board>>;
	getArrivals(params: BoardParams): Promise<ApiResult<Board>>;
	findStations(params: StationParams): Promise<ApiResult<StationSearchResult>>;
}

const ENDPOINTS = { arrival: "/arrivals", departure: "/departures" } as const;
/** Grenzen und Vorgaben von OpenBoards 1.0.3. */
const MAX_DURATION_MINUTES = 480;
const DEFAULT_DURATION_MINUTES = 60;
const MAX_ENTRIES_PER_TRANSPORT_TYPE = 50;
const DEFAULT_STATION_LIMIT = 20;

interface Window {
	start: Date;
	end: Date;
}

interface FetchedBoard {
	raw: RawBoard;
	stops: BoardStop[];
}

/** Fehlertext der DB, sofern die Antwort das dokumentierte Format hat. */
async function readErrorDetail(response: Response): Promise<string> {
	try {
		const body = (await response.json()) as Record<string, unknown>;
		// title/detail: OpenBoards; moreInformation: vorgelagertes API-Gateway.
		const detail = [body.title, body.detail, body.moreInformation]
			.filter((part) => typeof part === "string" && part)
			.join(": ")
			.slice(0, 300);
		return detail ? ` (${detail})` : "";
	} catch {
		return "";
	}
}

export class TimetableApiClient implements TimetableApi {
	constructor(
		private readonly apiConfig: TimetableApiConfig,
		private readonly fetchImplementation: typeof fetch = globalThis.fetch,
		private readonly now: () => Date = () => new Date(),
	) {}

	private assertCredentials(): void {
		if (this.apiConfig.clientId && this.apiConfig.clientSecret) return;
		throw new AuthenticationError(
			"DB-API-Zugangsdaten fehlen. Setze DB_TIMETABLE_CLIENT_ID und DB_TIMETABLE_CLIENT_SECRET in der .env-Datei oder in der MCP-Client-Konfiguration.",
		);
	}

	private async post(endpoint: string, body: unknown): Promise<unknown> {
		this.assertCredentials();
		try {
			const response = await this.fetchImplementation(
				`${this.apiConfig.baseUrl}${endpoint}`,
				{
					method: "POST",
					headers: {
						"DB-Client-ID": this.apiConfig.clientId,
						"DB-Api-Key": this.apiConfig.clientSecret,
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: JSON.stringify(body),
					signal: AbortSignal.timeout(this.apiConfig.timeoutMs),
				},
			);
			await this.assertSuccessfulResponse(response, endpoint);
			return await this.readJson(response);
		} catch (error) {
			if (error instanceof AppError) throw error;
			if (error instanceof Error && error.name === "TimeoutError") {
				throw new ApiError(
					"Zeitüberschreitung beim Abruf der DB OpenBoards API",
					"API_TIMEOUT",
					504,
				);
			}
			throw new ApiError(
				"DB OpenBoards API ist derzeit nicht erreichbar",
				"API_UNAVAILABLE",
				503,
			);
		}
	}

	private async readJson(response: Response): Promise<unknown> {
		const text = await response.text();
		try {
			return JSON.parse(text);
		} catch {
			throw this.invalidResponse();
		}
	}

	private invalidResponse(): ApiError {
		return new ApiError(
			"Die DB OpenBoards API lieferte eine Antwort in unerwartetem Format",
			"API_INVALID_RESPONSE",
			502,
		);
	}

	private async assertSuccessfulResponse(
		response: Response,
		endpoint: string,
	): Promise<void> {
		if (response.ok) return;
		const detail = await readErrorDetail(response);
		if (response.status === 401 || response.status === 403) {
			throw new AuthenticationError(
				`Die DB OpenBoards API hat die Zugangsdaten abgelehnt. Prüfe Client-ID, API-Key und das OpenBoards-Abonnement${detail}`,
			);
		}
		if (response.status === 404) {
			throw new ResourceNotFoundError(
				`Keine DB-Fahrplandaten für ${endpoint} gefunden${detail}`,
			);
		}
		const code = response.status === 429 ? "API_RATE_LIMIT" : "API_ERROR";
		throw new ApiError(
			`DB OpenBoards API antwortete mit HTTP ${response.status}${detail}`,
			code,
			response.status,
		);
	}

	private resolveWindow(params: BoardParams): Window {
		const start = params.startTime
			? parseBerlinTime(params.startTime)
			: this.now();
		if (!start) {
			throw new InvalidInputError(
				"startTime muss ein gültiger Zeitpunkt sein, z.B. 2026-07-17T10:00",
			);
		}
		const duration = params.durationMinutes ?? DEFAULT_DURATION_MINUTES;
		if (!(duration >= 1 && duration <= MAX_DURATION_MINUTES)) {
			throw new InvalidInputError(
				`durationMinutes muss zwischen 1 und ${MAX_DURATION_MINUTES} liegen`,
			);
		}
		return { start, end: new Date(start.getTime() + duration * 60_000) };
	}

	private async fetchBoard(
		kind: EventKind,
		params: BoardParams,
		window: Window,
	): Promise<FetchedBoard> {
		const payload = await this.post(ENDPOINTS[kind], {
			stopPlaceOrStation: {
				evaNumbers: [params.evaNo],
				...(params.platforms?.length && { platforms: params.platforms }),
				...(params.includeNearbyStops === false && {
					boardConfigurations: ["NONE"],
				}),
			},
			timeWindow: {
				timeStart: window.start.toISOString(),
				timeEnd: window.end.toISOString(),
			},
			maxEntriesPerTransportType:
				params.maxEntriesPerTransportType ?? MAX_ENTRIES_PER_TRANSPORT_TYPE,
			languages: ["deu"],
			...(params.transportTypes?.length && {
				transportTypes: params.transportTypes,
			}),
		});
		const raw = (payload ?? {}) as RawBoard;
		const list = kind === "arrival" ? raw.arrivals : raw.departures;
		// Eine leere Tafel kommt ohne Liste; meta belegt dann die gültige Antwort.
		const entries: unknown =
			list ?? (Array.isArray(raw.meta?.consideredStopPlaces) ? [] : undefined);
		if (!Array.isArray(entries)) throw this.invalidResponse();
		try {
			return { raw, stops: mapStops(raw, entries, kind) };
		} catch {
			throw this.invalidResponse();
		}
	}

	private boardResult(
		endpoint: string,
		params: BoardParams,
		window: Window,
		boards: RawBoard[],
		stops: BoardStop[],
	): ApiResult<Board> {
		const collect = (read: (board: RawBoard) => string[] | undefined) => [
			...new Set(boards.flatMap((board) => read(board) ?? [])),
		];
		const [ref] = mapStopRefs(boards, [params.evaNo]);
		const name = ref.name ?? soleStationName(boards);
		const station = { ...ref, ...(name && { name }) };
		return {
			source: "Deutsche Bahn OpenBoards API",
			retrievedAt: this.now().toISOString(),
			endpoint,
			data: {
				station,
				window: {
					start: toTimestamp(window.start.toISOString()),
					end: toTimestamp(window.end.toISOString()),
				},
				consideredStopPlaces: mapStopRefs(
					boards,
					collect((board) => board.meta?.consideredStopPlaces),
				),
				truncatedTransportTypes: collect(
					(board) => board.meta?.truncatedTransportTypes,
				),
				stops,
			},
		};
	}

	private async getSingleBoard(
		kind: EventKind,
		params: BoardParams,
	): Promise<ApiResult<Board>> {
		const window = this.resolveWindow(params);
		const board = await this.fetchBoard(kind, params, window);
		return this.boardResult(
			ENDPOINTS[kind],
			params,
			window,
			[board.raw],
			board.stops,
		);
	}

	async getDepartures(params: BoardParams): Promise<ApiResult<Board>> {
		return this.getSingleBoard("departure", params);
	}

	async getArrivals(params: BoardParams): Promise<ApiResult<Board>> {
		return this.getSingleBoard("arrival", params);
	}

	async getStationBoard(params: BoardParams): Promise<ApiResult<Board>> {
		const window = this.resolveWindow(params);
		const [arrivals, departures] = await Promise.all([
			this.fetchBoard("arrival", params, window),
			this.fetchBoard("departure", params, window),
		]);
		return this.boardResult(
			`${ENDPOINTS.arrival} + ${ENDPOINTS.departure}`,
			params,
			window,
			[arrivals.raw, departures.raw],
			mergeStops(arrivals.stops, departures.stops),
		);
	}

	async findStations({
		pattern,
		limit = DEFAULT_STATION_LIMIT,
	}: StationParams): Promise<ApiResult<StationSearchResult>> {
		return {
			source: "DB InfraGO OpenStation (NeTEx)",
			retrievedAt: this.now().toISOString(),
			dataAsOf: STATION_DATA_AS_OF,
			endpoint: "stations/stationIndex",
			data: searchStations(pattern, limit),
		};
	}
}
