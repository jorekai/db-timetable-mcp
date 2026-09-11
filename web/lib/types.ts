/*
 * Datenmodelle der DB Timetables API, wie sie der Worker über MCP liefert.
 * Bewusst strukturell identisch zum Server, nicht neu erfunden.
 */

export interface Station {
	evaNo: string;
	ds100: string;
	name: string;
	platforms: string[];
	metaStations: string[];
}

export interface TimeStamp {
	/** Unveränderter DB-Zeitstempel im Format YYMMDDHHMM (Wanduhr, Europe/Berlin). */
	raw: string;
	/** Lesbare lokale Zeit ohne Zonenangabe, z.B. "2026-09-11T09:22". */
	local: string;
	timezone: "Europe/Berlin";
}

export interface EventSnapshot {
	time?: TimeStamp;
	platform?: string;
	path?: string[];
	status?: "planned" | "added" | "cancelled" | "unknown";
	distantEndpoint?: string;
}

export interface TimetableEvent {
	/** Sollzustand. */
	planned?: EventSnapshot;
	/** Nur gemeldete Abweichungen. */
	changed?: EventSnapshot;
	/** Der anzuzeigende Wert. */
	effective: EventSnapshot;
	delayMinutes?: number;
	platformChanged: boolean;
	isCancelled: boolean;
	line?: string;
	messages?: TimetableMessage[];
}

export interface TimetableMessage {
	id: string;
	type: string;
	timestamp?: unknown;
	text?: string;
	category?: string;
	code?: number;
	priority?: "high" | "medium" | "low" | "done" | "unknown";
	validFrom?: unknown;
	validTo?: unknown;
}

export interface TimetableStop {
	id: string;
	evaNo: string;
	trip?: {
		category: string;
		number: string;
		operator: string;
		type?: string;
		filterFlags?: string;
	};
	arrival?: TimetableEvent;
	departure?: TimetableEvent;
	messages?: TimetableMessage[];
}

export interface TimetableDocument {
	station: { evaNo?: string; name?: string };
	stops: TimetableStop[];
	messages?: TimetableMessage[];
}

/** Der `structuredContent`-Rahmen, den jedes Werkzeug zurückgibt. */
export interface ApiPayload<T> {
	source: string;
	retrievedAt: string;
	endpoint: string;
	data: T;
}

/** Ein Eintrag aus `tools/list`, soweit die UI ihn braucht. */
export interface ToolDescriptor {
	name: string;
	title?: string;
	description?: string;
	inputSchema?: unknown;
}
