import { XMLParser, XMLValidator } from "fast-xml-parser";
import type {
	DbTimestamp,
	EventSnapshot,
	EventStatus,
	Station,
	TimetableDocument,
	TimetableEvent,
	TimetableMessage,
	TimetableStop,
	Trip,
} from "./types.js";

type XmlNode = Record<string, unknown>;

const ARRAY_ELEMENTS = new Set([
	"conn",
	"dm",
	"hd",
	"hpc",
	"m",
	"rtr",
	"s",
	"station",
	"tl",
]);

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "",
	parseAttributeValue: false,
	parseTagValue: false,
	trimValues: true,
	isArray: (name) => ARRAY_ELEMENTS.has(name),
});

const EVENT_STATUS: Record<string, EventStatus> = {
	p: "planned",
	a: "added",
	c: "cancelled",
};

const MESSAGE_TYPE: Record<string, string> = {
	h: "him",
	q: "quality_change",
	f: "free_text",
	d: "cause_of_delay",
	i: "ibis",
	u: "unassigned_ibis",
	r: "disruption",
	c: "connection",
};

const PRIORITY = {
	"1": "high",
	"2": "medium",
	"3": "low",
	"4": "done",
} as const;

const TRIP_TYPE: Record<string, string> = {
	p: "passenger",
	e: "replacement",
	z: "additional",
	s: "suburban",
	h: "auxiliary",
	n: "night",
};

function parseXml(xml: string): XmlNode {
	const validation = XMLValidator.validate(xml);
	if (validation !== true) {
		throw new Error(
			`Ungültige XML-Antwort der DB Timetables API: ${validation.err.msg}`,
		);
	}
	return parser.parse(xml) as XmlNode;
}

function asNode(value: unknown): XmlNode | undefined {
	return value && typeof value === "object" ? (value as XmlNode) : undefined;
}

function asNodes(value: unknown): XmlNode[] {
	if (Array.isArray(value)) {
		return value
			.map((item) => asNode(item))
			.filter((node): node is XmlNode => Boolean(node));
	}
	const node = asNode(value);
	return node ? [node] : [];
}

function asString(value: unknown): string | undefined {
	if (Array.isArray(value)) return asString(value[0]);
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function splitList(value: unknown): string[] {
	return asString(value)?.split("|").filter(Boolean) ?? [];
}

function toTimestamp(value: unknown): DbTimestamp | undefined {
	const raw = asString(value);
	if (!raw) return undefined;
	const match = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(raw);
	const local = match
		? `20${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`
		: raw;
	return { raw, local, timezone: "Europe/Berlin" };
}

function toEpochMinutes(timestamp?: DbTimestamp): number | undefined {
	const match =
		timestamp && /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(timestamp.raw);
	if (!match) return undefined;
	return (
		Date.UTC(
			2000 + Number(match[1]),
			Number(match[2]) - 1,
			Number(match[3]),
			Number(match[4]),
			Number(match[5]),
		) / 60_000
	);
}

function parseStatus(value: unknown): EventStatus | undefined {
	const status = asString(value);
	return status ? (EVENT_STATUS[status] ?? "unknown") : undefined;
}

function parseSnapshot(node: XmlNode, kind: "planned" | "changed") {
	const prefix = kind === "planned" ? "p" : "c";
	const time = toTimestamp(node[`${prefix}t`]);
	const platform = asString(node[`${prefix}p`]);
	const pathValue = asString(node[`${prefix}pth`]);
	const status = parseStatus(node[`${prefix}s`]);
	const distantEndpoint = asString(node[`${prefix}de`]);
	if (!time && !platform && !pathValue && !status && !distantEndpoint) return;
	return compactSnapshot({
		time,
		platform,
		path: pathValue ? splitList(pathValue) : undefined,
		status,
		distantEndpoint,
	} satisfies EventSnapshot);
}

function compactSnapshot(snapshot: EventSnapshot): EventSnapshot {
	return Object.fromEntries(
		Object.entries(snapshot).filter(([, value]) => value !== undefined),
	) as EventSnapshot;
}

function calculateDelay(
	planned?: EventSnapshot,
	changed?: EventSnapshot,
): number | undefined {
	const plannedMinutes = toEpochMinutes(planned?.time);
	const changedMinutes = toEpochMinutes(changed?.time);
	return plannedMinutes === undefined || changedMinutes === undefined
		? undefined
		: changedMinutes - plannedMinutes;
}

function parseMessage(node: XmlNode): TimetableMessage | undefined {
	const id = asString(node.id);
	if (!id) return undefined;
	const priorityCode = asString(node.pr);
	const code = Number.parseInt(asString(node.c) ?? "", 10);
	return {
		id,
		type: MESSAGE_TYPE[asString(node.t) ?? ""] ?? "unknown",
		timestamp: toTimestamp(node.ts),
		text: asString(node.ext) ?? asString(node.int),
		category: asString(node.cat),
		code: Number.isNaN(code) ? undefined : code,
		priority: priorityCode
			? (PRIORITY[priorityCode as keyof typeof PRIORITY] ?? "unknown")
			: undefined,
		validFrom: toTimestamp(node.from),
		validTo: toTimestamp(node.to),
	};
}

function parseMessages(value: unknown): TimetableMessage[] | undefined {
	const messages = asNodes(value).flatMap((node) => parseMessage(node) ?? []);
	return messages.length > 0 ? messages : undefined;
}

function buildEvent(
	planned: EventSnapshot | undefined,
	changed: EventSnapshot | undefined,
	messages: TimetableMessage[] | undefined,
	line: string | undefined,
): TimetableEvent | undefined {
	if (!planned && !changed && !messages && !line) return undefined;
	const effective = compactSnapshot({ ...planned, ...changed });
	return {
		planned,
		changed,
		effective,
		delayMinutes: calculateDelay(planned, changed),
		platformChanged: Boolean(
			planned?.platform &&
				changed?.platform &&
				planned.platform !== changed.platform,
		),
		isCancelled:
			changed?.status === "cancelled" || planned?.status === "cancelled",
		line,
		messages,
	};
}

function parseEvent(value: unknown): TimetableEvent | undefined {
	const node = asNode(value);
	if (!node) return undefined;
	return buildEvent(
		parseSnapshot(node, "planned"),
		parseSnapshot(node, "changed"),
		parseMessages(node.m),
		asString(node.l),
	);
}

function parseTrip(value: unknown): Trip | undefined {
	const node = asNodes(value)[0];
	const category = node && asString(node.c);
	const number = node && asString(node.n);
	const operator = node && asString(node.o);
	if (!category || !number || !operator) return undefined;
	const typeCode = asString(node.t);
	return {
		category,
		number,
		operator,
		type: typeCode ? (TRIP_TYPE[typeCode] ?? "unknown") : undefined,
		filterFlags: asString(node.f),
	};
}

function parseStop(node: XmlNode): TimetableStop | undefined {
	const id = asString(node.id);
	const evaNo = asString(node.eva);
	if (!id || !evaNo) return undefined;
	return {
		id,
		evaNo,
		trip: parseTrip(node.tl),
		arrival: parseEvent(node.ar),
		departure: parseEvent(node.dp),
		messages: parseMessages(node.m),
	};
}

export function parseTimetableXml(xml: string): TimetableDocument {
	const timetable = asNode(parseXml(xml).timetable);
	if (!timetable) {
		throw new Error(
			"Ungültige XML-Antwort der DB Timetables API: timetable fehlt",
		);
	}
	return {
		station: {
			evaNo: asString(timetable.eva),
			name: asString(timetable.station),
		},
		stops: asNodes(timetable.s).flatMap((node) => parseStop(node) ?? []),
		messages: parseMessages(timetable.m),
	};
}

function mergeMessages(
	first?: TimetableMessage[],
	second?: TimetableMessage[],
): TimetableMessage[] | undefined {
	const messages = [...(first ?? []), ...(second ?? [])];
	const unique = [
		...new Map(messages.map((message) => [message.id, message])).values(),
	];
	return unique.length > 0 ? unique : undefined;
}

function mergeEvents(
	planned?: TimetableEvent,
	changed?: TimetableEvent,
): TimetableEvent | undefined {
	return buildEvent(
		planned?.planned ?? changed?.planned,
		changed?.changed ?? planned?.changed,
		mergeMessages(planned?.messages, changed?.messages),
		changed?.line ?? planned?.line,
	);
}

function mergeStop(planned: TimetableStop, changed?: TimetableStop) {
	if (!changed) return planned;
	return {
		...planned,
		...changed,
		trip: changed.trip ?? planned.trip,
		arrival: mergeEvents(planned.arrival, changed.arrival),
		departure: mergeEvents(planned.departure, changed.departure),
		messages: mergeMessages(planned.messages, changed.messages),
	};
}

function eventTime(stop: TimetableStop): string {
	return (
		stop.departure?.effective.time?.raw ??
		stop.arrival?.effective.time?.raw ??
		""
	);
}

export function mergeTimetables(
	planned: TimetableDocument,
	changes: TimetableDocument,
): TimetableDocument {
	const changesById = new Map(changes.stops.map((stop) => [stop.id, stop]));
	const plannedIds = new Set(planned.stops.map((stop) => stop.id));
	const stops = planned.stops.map((stop) =>
		mergeStop(stop, changesById.get(stop.id)),
	);
	stops.push(...changes.stops.filter((stop) => !plannedIds.has(stop.id)));
	return {
		station: {
			evaNo: planned.station.evaNo ?? changes.station.evaNo,
			name: planned.station.name ?? changes.station.name,
		},
		stops: stops.sort((left, right) =>
			eventTime(left).localeCompare(eventTime(right)),
		),
		messages: mergeMessages(planned.messages, changes.messages),
	};
}

export function parseStationsXml(xml: string): Station[] {
	const root = parseXml(xml);
	const stations = asNode(root.stations) ?? asNode(root.multipleStationData);
	if (!stations) {
		throw new Error(
			"Ungültige XML-Antwort der DB Timetables API: stations fehlt",
		);
	}
	return asNodes(stations.station).flatMap((station) => {
		const evaNo = asString(station.eva);
		const ds100 = asString(station.ds100);
		const name = asString(station.name);
		if (!evaNo || !ds100 || !name) return [];
		return [
			{
				evaNo,
				ds100,
				name,
				platforms: splitList(station.p),
				metaStations: splitList(station.meta),
			},
		];
	});
}
