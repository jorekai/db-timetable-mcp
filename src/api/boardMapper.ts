import { toTimestamp } from "../utils/berlinTime.js";
import type {
	LocalizedText,
	RawBoard,
	RawEntry,
	RawStopRef,
} from "./openBoards.js";
import type {
	BoardEvent,
	BoardMessage,
	BoardStop,
	StopRef,
	Trip,
} from "./types.js";

export type EventKind = "arrival" | "departure";

const MESSAGE_TYPES = {
	disruptions: "disruption",
	risCauseCodes: "cause",
	risQualityDeviations: "quality",
	notes: "note",
	attributes: "attribute",
} as const;

function german<T extends { language: string }>(
	entries: T[] | undefined,
): T | undefined {
	return entries?.find((entry) => entry.language === "deu") ?? entries?.[0];
}

/** Nachschlagewerke einer Antwort: Namen, Betreiber und Meldungen nach ID. */
class Lookup {
	private readonly names = new Map<string, string>();
	private readonly operators = new Map<string, Trip["operator"]>();
	private readonly messages = new Map<number, BoardMessage[]>();

	constructor(board: RawBoard) {
		for (const place of board.stopPlaces ?? []) {
			const name = german(place.localizedNames)?.name;
			if (name) this.names.set(place.evaNumber, name);
		}
		for (const entry of board.administrations ?? []) {
			this.operators.set(entry.administrationId, {
				code: entry.operatorCode,
				name: entry.operatorName,
			});
		}
		for (const [group, type] of Object.entries(MESSAGE_TYPES)) {
			const entries = board.messages?.[group as keyof typeof MESSAGE_TYPES];
			for (const entry of entries ?? []) {
				const description: LocalizedText | undefined = german(
					entry.descriptions,
				);
				if (!description?.text) continue;
				this.messages.set(entry.messageID, [
					...(this.messages.get(entry.messageID) ?? []),
					{
						type,
						text: description.text,
						...(description.textShort && { shortText: description.textShort }),
						...(entry.code !== undefined && { code: String(entry.code) }),
						...(entry.effect && { effect: entry.effect }),
					},
				]);
			}
		}
	}

	stop(ref: RawStopRef): StopRef {
		const name = this.names.get(ref.evaNumber);
		return {
			evaNo: ref.evaNumber,
			...(name && { name }),
			...(ref.cancelled && { cancelled: true }),
			...(ref.additional && { additional: true }),
		};
	}

	operator(id?: string): Trip["operator"] {
		return id === undefined ? undefined : this.operators.get(id);
	}

	resolve(ids: number[] = []): BoardMessage[] {
		return ids.flatMap((id) => this.messages.get(id) ?? []);
	}
}

function mapEvent(entry: RawEntry, lookup: Lookup): BoardEvent {
	const plannedPlatform = entry.platformSchedule?.name;
	const platform = entry.platform?.name ?? plannedPlatform;
	const delayMs = Date.parse(entry.time) - Date.parse(entry.timeSchedule);
	return {
		planned: {
			time: toTimestamp(entry.timeSchedule),
			...(plannedPlatform && { platform: plannedPlatform }),
		},
		effective: {
			time: toTimestamp(entry.time),
			...(platform && { platform }),
		},
		timeType: entry.timeType,
		delayMinutes: Math.round(delayMs / 60_000),
		platformChanged: Boolean(
			plannedPlatform && platform && plannedPlatform !== platform,
		),
		isCancelled: entry.cancelled === true,
		isAdditional: entry.additional === true,
		noPassengerChange: entry.noPassengerChange === true,
		via: (entry.transport.via ?? []).map((ref) => lookup.stop(ref)),
		messages: lookup.resolve(entry.messages),
	};
}

function mapTrip(entry: RawEntry, lookup: Lookup): Trip {
	const { transport, journeyInfo } = entry;
	const line = transport.line?.name;
	const operator = lookup.operator(transport.administrationId);
	const direction =
		transport.direction?.texts?.join(" / ") ||
		transport.direction?.stopPlaces
			?.map((ref) => lookup.stop(ref).name ?? ref.evaNumber)
			.join(" / ");
	const refs = {
		origin: journeyInfo?.origin,
		destination: journeyInfo?.destination,
		differingOrigin: journeyInfo?.differingOrigin,
		differingDestination: journeyInfo?.differingDestination,
	};
	return {
		type: transport.type,
		category: transport.category,
		number: String(transport.journeyNumber),
		...(line && { line }),
		...(transport.journeyDescription && {
			description: transport.journeyDescription,
		}),
		...(operator && { operator }),
		...Object.fromEntries(
			Object.entries(refs)
				.filter((ref): ref is [string, RawStopRef] => Boolean(ref[1]))
				.map(([key, ref]) => [key, lookup.stop(ref)]),
		),
		...(direction && { direction }),
		...(transport.replacementTransport && {
			replacementTransport:
				transport.replacementTransport.realType ?? "unknown",
		}),
		isCancelled: journeyInfo?.journeyCancelled === true,
	};
}

export function mapStops(
	board: RawBoard,
	entries: RawEntry[],
	kind: EventKind,
): BoardStop[] {
	const lookup = new Lookup(board);
	return entries.map((entry) => {
		const { name } = lookup.stop({ evaNumber: entry.evaNumber });
		return {
			journeyId: entry.journeyId,
			evaNo: entry.evaNumber,
			...(name && { stationName: name }),
			trip: mapTrip(entry, lookup),
			[kind]: mapEvent(entry, lookup),
		};
	});
}

export function mapStopRefs(
	boards: RawBoard[],
	evaNumbers: string[],
): StopRef[] {
	const lookup = new Lookup({
		stopPlaces: boards.flatMap((board) => board.stopPlaces ?? []),
	});
	return evaNumbers.map((evaNumber) => lookup.stop({ evaNumber }));
}

/** Leere Tafeln enthalten keine Haltestellen, nur den Namen der Station. */
export function soleStationName(boards: RawBoard[]): string | undefined {
	const names = new Set(
		boards.flatMap((board) =>
			(board.stations ?? []).map(
				(station) => german(station.localizedNames)?.name,
			),
		),
	);
	return names.size === 1 ? [...names][0] : undefined;
}

function scheduled(event: BoardEvent | undefined): number {
	return Date.parse(event?.planned.time.raw ?? "");
}

function sortKey(stop: BoardStop): number {
	const event = stop.departure ?? stop.arrival;
	return Date.parse(event?.effective.time.raw ?? "");
}

/**
 * Führt Ankunft und Abfahrt derselben Fahrt am selben Halt zusammen. Ringlinien
 * halten mehrfach am selben Bahnhof; deshalb bekommt jede Abfahrt die letzte
 * noch freie Ankunft, die planmäßig nicht nach ihr liegt.
 */
export function mergeStops(
	arrivals: BoardStop[],
	departures: BoardStop[],
): BoardStop[] {
	const key = (stop: BoardStop) => `${stop.journeyId}|${stop.evaNo}`;
	const open = new Map<string, BoardStop[]>();
	for (const stop of arrivals) {
		open.set(key(stop), [...(open.get(key(stop)) ?? []), stop]);
	}
	const merged = [...departures]
		.sort((a, b) => scheduled(a.departure) - scheduled(b.departure))
		.map((stop) => {
			const candidates = open.get(key(stop)) ?? [];
			const match = candidates
				.filter(
					(entry) => scheduled(entry.arrival) <= scheduled(stop.departure),
				)
				.sort((a, b) => scheduled(b.arrival) - scheduled(a.arrival))[0];
			if (!match) return stop;
			open.set(
				key(stop),
				candidates.filter((entry) => entry !== match),
			);
			return { ...stop, arrival: match.arrival };
		});
	return [...merged, ...[...open.values()].flat()].sort(
		(a, b) => sortKey(a) - sortKey(b),
	);
}
