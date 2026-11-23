export interface DbTimestamp {
	/** Unveränderter ISO-8601-Zeitstempel der DB. */
	raw: string;
	/** Lokale Zeit in Europe/Berlin ohne Offset, minutengenau. */
	local: string;
	timezone: "Europe/Berlin";
}

export type TransportType =
	| "HIGH_SPEED_TRAIN"
	| "INTERCITY_TRAIN"
	| "INTER_REGIONAL_TRAIN"
	| "REGIONAL_TRAIN"
	| "CITY_TRAIN";

export interface StopRef {
	evaNo: string;
	name?: string;
	cancelled?: boolean;
	additional?: boolean;
}

export interface BoardMessage {
	type: "attribute" | "disruption" | "note" | "cause" | "quality";
	text: string;
	shortText?: string;
	code?: string;
	effect?: string;
}

export interface EventSnapshot {
	time: DbTimestamp;
	platform?: string;
}

export interface BoardEvent {
	planned: EventSnapshot;
	effective: EventSnapshot;
	/** SCHEDULE = Soll, PREVIEW = Prognose, REAL = eingetreten. */
	timeType: string;
	delayMinutes: number;
	platformChanged: boolean;
	isCancelled: boolean;
	isAdditional: boolean;
	noPassengerChange: boolean;
	/** Ankunft: frühere Halte. Abfahrt: kommende Halte. Nur eine Auswahl. */
	via: StopRef[];
	messages: BoardMessage[];
}

export interface Trip {
	type: string;
	category: string;
	number: string;
	line?: string;
	description?: string;
	operator?: { code?: string; name?: string };
	origin?: StopRef;
	destination?: StopRef;
	differingOrigin?: StopRef;
	differingDestination?: StopRef;
	direction?: string;
	replacementTransport?: string;
	isCancelled: boolean;
}

export interface BoardStop {
	journeyId: string;
	evaNo: string;
	stationName?: string;
	trip: Trip;
	arrival?: BoardEvent;
	departure?: BoardEvent;
}

export interface Board {
	station: { evaNo: string; name?: string };
	window: { start: DbTimestamp; end: DbTimestamp };
	/** Haltestellen, die die DB in die Tafel einbezogen hat. */
	consideredStopPlaces: StopRef[];
	/** Produktklassen, deren Einträge am Limit abgeschnitten wurden. */
	truncatedTransportTypes: string[];
	stops: BoardStop[];
}

export interface Station {
	evaNo: string;
	evaNumbers: string[];
	ds100Codes: string[];
	stada?: string;
	name: string;
	otherNames: string[];
	platforms: string[];
}

export interface StationSearchResult {
	totalMatches: number;
	stations: Station[];
}

export interface BoardParams {
	evaNo: string;
	/** ISO 8601; ohne Offset gilt Europe/Berlin. Standard: jetzt. */
	startTime?: string;
	durationMinutes?: number;
	platforms?: string[];
	transportTypes?: TransportType[];
	includeNearbyStops?: boolean;
	maxEntriesPerTransportType?: number;
}

export interface StationParams {
	pattern: string;
	limit?: number;
}

export interface ApiResult<T> {
	source: "Deutsche Bahn OpenBoards API" | "DB InfraGO OpenStation (NeTEx)";
	retrievedAt: string;
	/** Stand der Daten, wenn sie nicht zum Abrufzeitpunkt entstanden sind. */
	dataAsOf?: string;
	endpoint: string;
	data: T;
}
