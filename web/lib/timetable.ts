/*
 * Zeit- und Tafel-Logik. Die DB-API liefert Wanduhrzeiten in Europe/Berlin
 * ohne Zonenangabe. Deshalb wird für die Anzeige ausschließlich `raw`
 * (YYMMDDHHMM) zerlegt und nie `new Date(local)` gebildet, das in anderen
 * Zeitzonen verschöbe.
 */

import { GRACE_MS } from "./config";
import type { TimetableEvent, TimetableMessage, TimetableStop } from "./types";

export interface Departure {
	stopId: string;
	label: string | null;
	destination: string | null;
	plannedHhmm: string | null;
	changedHhmm: string | null;
	effectiveHhmm: string | null;
	plannedPlatform: string | null;
	effectivePlatform: string | null;
	platformChanged: boolean;
	delayMinutes: number | null;
	cancelled: boolean;
	hasRealtime: boolean;
	messages: TimetableMessage[];
	sortKey: number;
}

/** YYMMDDHHMM einer Wanduhrzeit in Europe/Berlin. */
export function berlinParts(date: Date): {
	yy: string;
	mm: string;
	dd: string;
	hh: string;
	mi: string;
} {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Europe/Berlin",
		year: "2-digit",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(date);

	const get = (type: string) =>
		parts.find((part) => part.type === type)?.value ?? "00";
	const hour = get("hour");
	return {
		yy: get("year"),
		mm: get("month"),
		dd: get("day"),
		hh: hour === "24" ? "00" : hour,
		mi: get("minute"),
	};
}

/** Sortierschlüssel eines Stempels, in derselben Pseudo-UTC-Basis wie die API. */
export function stampToMillis(stamp: string | undefined | null): number | null {
	if (typeof stamp !== "string" || !/^\d{10}$/.test(stamp)) return null;
	return Date.UTC(
		2000 + Number(stamp.slice(0, 2)),
		Number(stamp.slice(2, 4)) - 1,
		Number(stamp.slice(4, 6)),
		Number(stamp.slice(6, 8)),
		Number(stamp.slice(8, 10)),
	);
}

/** "HH:MM" aus einem Rohstempel, ohne Zeitzonen-Interpretation. */
export function hhmm(stamp: string | undefined | null): string | null {
	if (typeof stamp !== "string" || stamp.length < 10) return null;
	return `${stamp.slice(6, 8)}:${stamp.slice(8, 10)}`;
}

/** Alter einer ISO-Zeit in Sekunden. */
export function ageSeconds(iso: string | null): number | null {
	if (!iso) return null;
	const parsed = Date.parse(iso);
	if (Number.isNaN(parsed)) return null;
	return Math.max(0, Math.round((Date.now() - parsed) / 1000));
}

function toDeparture(stop: TimetableStop): Departure | null {
	const event: TimetableEvent | undefined = stop.departure ?? stop.arrival;
	if (!event) return null;

	const planned = event.planned?.time?.raw ?? null;
	const changed = event.changed?.time?.raw ?? null;
	const effective = event.effective?.time?.raw ?? planned ?? changed;

	const plannedPlatform = event.planned?.platform ?? null;
	const effectivePlatform =
		event.effective?.platform ?? plannedPlatform ?? null;

	const path = event.effective?.path ?? event.planned?.path ?? [];
	const destination =
		event.effective?.distantEndpoint ??
		event.planned?.distantEndpoint ??
		(path.length > 0 ? path[path.length - 1] : null);

	const tripLabel = [stop.trip?.category, stop.trip?.number]
		.filter(Boolean)
		.join(" ");
	// Echtzeit-Datensätze der DB tragen die Linie direkt am Ereignis, ohne trip.
	const label = tripLabel || event.line || null;

	return {
		stopId: stop.id,
		label,
		destination,
		plannedHhmm: hhmm(planned),
		changedHhmm: hhmm(changed),
		effectiveHhmm: hhmm(effective),
		plannedPlatform,
		effectivePlatform,
		platformChanged: Boolean(event.platformChanged),
		delayMinutes: event.delayMinutes ?? null,
		cancelled: Boolean(event.isCancelled),
		hasRealtime: Boolean(event.changed),
		messages: [...(event.messages ?? []), ...(stop.messages ?? [])],
		sortKey: stampToMillis(effective) ?? Number.POSITIVE_INFINITY,
	};
}

/** Kommende Abfahrten aus einer zusammengeführten Tafel, bereits sortiert. */
export function buildDepartures(stops: TimetableStop[]): Departure[] {
	const now = berlinParts(new Date());
	const nowMs =
		stampToMillis(`${now.yy}${now.mm}${now.dd}${now.hh}${now.mi}`) ?? 0;

	const departures: Departure[] = [];
	for (const stop of stops) {
		if (!stop.departure) continue;
		const departure = toDeparture(stop);
		if (!departure) continue;
		if (departure.sortKey >= nowMs - GRACE_MS) departures.push(departure);
	}

	departures.sort((a, b) => a.sortKey - b.sortKey);
	return departures;
}

/** Anzahl der Halte ohne Abfahrt, also reine Ankünfte. */
export function countArrivalOnly(stops: TimetableStop[]): number {
	return stops.filter((stop) => !stop.departure).length;
}
