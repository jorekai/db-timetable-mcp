import {
	ApiError,
	AppError,
	AuthenticationError,
	ResourceNotFoundError,
} from "../utils/errorHandling.js";
import {
	mergeTimetables,
	parseStationsXml,
	parseTimetableXml,
} from "./timetableParser.js";
import type {
	ApiResult,
	PlanParams,
	Station,
	StationBoardParams,
	StationParams,
	TimetableDocument,
	TimetableParams,
} from "./types.js";

export interface TimetableApiConfig {
	baseUrl: string;
	clientId: string;
	clientSecret: string;
	timeoutMs: number;
}

export interface TimetableApi {
	getCurrentTimetable(
		params: TimetableParams,
	): Promise<ApiResult<TimetableDocument>>;
	getRecentChanges(
		params: TimetableParams,
	): Promise<ApiResult<TimetableDocument>>;
	getPlannedTimetable(
		params: PlanParams,
	): Promise<ApiResult<TimetableDocument>>;
	findStations(params: StationParams): Promise<ApiResult<Station[]>>;
	getStationBoard(
		params: StationBoardParams,
	): Promise<ApiResult<TimetableDocument>>;
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

	private async fetchXml(endpoint: string): Promise<string> {
		this.assertCredentials();
		try {
			const response = await this.fetchImplementation(
				`${this.apiConfig.baseUrl}${endpoint}`,
				{
					headers: {
						"DB-Client-Id": this.apiConfig.clientId,
						"DB-Api-Key": this.apiConfig.clientSecret,
						Accept: "application/xml",
					},
					signal: AbortSignal.timeout(this.apiConfig.timeoutMs),
				},
			);
			this.assertSuccessfulResponse(response, endpoint);
			return await response.text();
		} catch (error) {
			if (error instanceof AppError) throw error;
			if (error instanceof Error && error.name === "TimeoutError") {
				throw new ApiError(
					"Zeitüberschreitung beim Abruf der DB Timetables API",
					"API_TIMEOUT",
					504,
				);
			}
			throw new ApiError(
				"DB Timetables API ist derzeit nicht erreichbar",
				"API_UNAVAILABLE",
				503,
			);
		}
	}

	private assertSuccessfulResponse(response: Response, endpoint: string): void {
		if (response.ok) return;
		if (response.status === 401 || response.status === 403) {
			throw new AuthenticationError(
				"Die DB Timetables API hat die Zugangsdaten abgelehnt. Prüfe Client-ID, API-Key und das Timetables-Abonnement.",
			);
		}
		if (response.status === 404) {
			throw new ResourceNotFoundError(
				`Keine DB-Fahrplandaten für ${endpoint} gefunden`,
			);
		}
		const code = response.status === 429 ? "API_RATE_LIMIT" : "API_ERROR";
		throw new ApiError(
			`DB Timetables API antwortete mit HTTP ${response.status}`,
			code,
			response.status,
		);
	}

	private result<T>(
		endpoint: string,
		data: T,
		rawXml?: string | Record<string, string>,
	): ApiResult<T> {
		return {
			source: "Deutsche Bahn Timetables API",
			retrievedAt: this.now().toISOString(),
			endpoint,
			data,
			rawXml,
		};
	}

	private async getTimetable(
		endpoint: string,
		evaNo: string,
		includeRawXml = false,
	): Promise<ApiResult<TimetableDocument>> {
		const xml = await this.fetchXml(endpoint);
		return this.result(
			endpoint,
			parseTimetableXml(xml, evaNo),
			includeRawXml ? xml : undefined,
		);
	}

	async getCurrentTimetable({
		evaNo,
		includeRawXml,
	}: TimetableParams): Promise<ApiResult<TimetableDocument>> {
		return this.getTimetable(
			`/fchg/${encodeURIComponent(evaNo)}`,
			evaNo,
			includeRawXml,
		);
	}

	async getRecentChanges({
		evaNo,
		includeRawXml,
	}: TimetableParams): Promise<ApiResult<TimetableDocument>> {
		return this.getTimetable(
			`/rchg/${encodeURIComponent(evaNo)}`,
			evaNo,
			includeRawXml,
		);
	}

	async getPlannedTimetable({
		evaNo,
		date,
		hour,
		includeRawXml,
	}: PlanParams): Promise<ApiResult<TimetableDocument>> {
		const endpoint = `/plan/${encodeURIComponent(evaNo)}/${date}/${hour}`;
		return this.getTimetable(endpoint, evaNo, includeRawXml);
	}

	async findStations({
		pattern,
		includeRawXml,
	}: StationParams): Promise<ApiResult<Station[]>> {
		const endpoint = `/station/${encodeURIComponent(pattern)}`;
		const xml = await this.fetchXml(endpoint);
		return this.result(
			endpoint,
			parseStationsXml(xml),
			includeRawXml ? xml : undefined,
		);
	}

	async getStationBoard({
		evaNo,
		date,
		hour,
		includeRawXml,
	}: StationBoardParams): Promise<ApiResult<TimetableDocument>> {
		const planEndpoint = `/plan/${encodeURIComponent(evaNo)}/${date}/${hour}`;
		const changesEndpoint = `/fchg/${encodeURIComponent(evaNo)}`;
		const [plannedXml, changesXml] = await Promise.all([
			this.fetchXml(planEndpoint),
			this.fetchXml(changesEndpoint),
		]);
		const data = mergeTimetables(
			parseTimetableXml(plannedXml, evaNo),
			parseTimetableXml(changesXml, evaNo),
		);
		return this.result(
			`${planEndpoint} + ${changesEndpoint}`,
			data,
			includeRawXml ? { planned: plannedXml, changes: changesXml } : undefined,
		);
	}
}
