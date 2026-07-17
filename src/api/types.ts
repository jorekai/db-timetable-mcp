export interface DbTimestamp {
	raw: string;
	local: string;
	timezone: "Europe/Berlin";
}

export type EventStatus = "planned" | "added" | "cancelled" | "unknown";

export interface EventSnapshot {
	time?: DbTimestamp;
	platform?: string;
	path?: string[];
	status?: EventStatus;
	distantEndpoint?: string;
}

export interface TimetableMessage {
	id: string;
	type: string;
	timestamp?: DbTimestamp;
	text?: string;
	category?: string;
	code?: number;
	priority?: "high" | "medium" | "low" | "done" | "unknown";
	validFrom?: DbTimestamp;
	validTo?: DbTimestamp;
}

export interface TimetableEvent {
	planned?: EventSnapshot;
	changed?: EventSnapshot;
	effective: EventSnapshot;
	delayMinutes?: number;
	platformChanged: boolean;
	isCancelled: boolean;
	line?: string;
	messages?: TimetableMessage[];
}

export interface Trip {
	category: string;
	number: string;
	operator: string;
	type?: string;
	filterFlags?: string;
}

export interface TimetableStop {
	id: string;
	evaNo: string;
	trip?: Trip;
	arrival?: TimetableEvent;
	departure?: TimetableEvent;
	messages?: TimetableMessage[];
}

export interface TimetableDocument {
	station: {
		evaNo?: string;
		name?: string;
	};
	stops: TimetableStop[];
	messages?: TimetableMessage[];
}

export interface Station {
	evaNo: string;
	ds100: string;
	name: string;
	platforms: string[];
	metaStations: string[];
}

export interface TimetableParams {
	evaNo: string;
	includeRawXml?: boolean;
}

export interface PlanParams extends TimetableParams {
	date: string;
	hour: string;
}

export interface StationParams {
	pattern: string;
	includeRawXml?: boolean;
}

export interface StationBoardParams extends PlanParams {}

export interface ApiResult<T> {
	source: "Deutsche Bahn Timetables API";
	retrievedAt: string;
	endpoint: string;
	data: T;
	rawXml?: string | Record<string, string>;
}
