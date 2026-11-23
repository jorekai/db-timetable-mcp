/**
 * Ausschnitt der OpenBoards-Antwort (API 1.0.3), den dieser Server auswertet.
 * Die API darf Felder ergänzen; unbekannte Felder werden ignoriert.
 */
export interface LocalizedText {
	language: string;
	text: string;
	textShort?: string;
}

export interface RawStopRef {
	evaNumber: string;
	cancelled?: boolean;
	additional?: boolean;
}

export interface RawTransport {
	type: string;
	category: string;
	journeyNumber: number | string;
	journeyDescription?: string;
	label?: string;
	line?: { name?: string };
	administrationId?: string;
	direction?: { stopPlaces?: { evaNumber: string }[]; texts?: string[] };
	via?: RawStopRef[];
	replacementTransport?: { realType?: string };
}

export interface RawEntry {
	evaNumber: string;
	journeyId: string;
	time: string;
	timeSchedule: string;
	timeType: string;
	cancelled?: boolean;
	additional?: boolean;
	noPassengerChange?: boolean;
	platform?: { name: string };
	platformSchedule?: { name: string };
	messages?: number[];
	journeyInfo?: {
		origin?: RawStopRef;
		destination?: RawStopRef;
		differingOrigin?: RawStopRef;
		differingDestination?: RawStopRef;
		journeyCancelled?: boolean;
	};
	transport: RawTransport;
}

interface RawMessage {
	messageID: number;
	code?: number | string;
	effect?: string;
	descriptions?: LocalizedText[];
}

export interface RawBoard {
	administrations?: {
		administrationId: string;
		operatorCode?: string;
		operatorName?: string;
	}[];
	departures?: RawEntry[];
	arrivals?: RawEntry[];
	messages?: {
		attributes?: RawMessage[];
		disruptions?: RawMessage[];
		notes?: RawMessage[];
		risCauseCodes?: RawMessage[];
		risQualityDeviations?: RawMessage[];
	};
	meta?: {
		consideredStopPlaces?: string[];
		truncatedTransportTypes?: string[];
	};
	stations?: {
		stada?: string;
		localizedNames?: { language: string; name: string }[];
	}[];
	stopPlaces?: {
		evaNumber: string;
		localizedNames?: { language: string; name: string }[];
	}[];
}
