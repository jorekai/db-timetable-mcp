import type { DbTimestamp } from "../api/types.js";

const FORMATTER = new Intl.DateTimeFormat("en-GB", {
	timeZone: "Europe/Berlin",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

const LOCAL_PATTERN =
	/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?$/;

const OFFSET_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

function toBerlinLocal(date: Date): string {
	const parts = Object.fromEntries(
		FORMATTER.formatToParts(date).map((part) => [part.type, part.value])
	);

	return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function toTimestamp(raw: string): DbTimestamp {
	return {
		raw,
		local: toBerlinLocal(new Date(raw)),
		timezone: "Europe/Berlin",
	};
}

function berlinOffsetMs(instant: number): number {
	const minute = Math.floor(instant / 60_000) * 60_000;

	return Date.parse(`${toBerlinLocal(new Date(minute))}:00Z`) - minute;
}

/**
 * Liest ISO 8601 mit Offset oder als Ortszeit Berlin. Liefert `undefined`, wenn
 * der Wert kein gültiger Zeitpunkt ist. In der Nacht der Zeitumstellung gilt
 * bei doppelten Ortszeiten die frühere; ausgelassene rücken eine Stunde vor.
 */
export function parseBerlinTime(value: string): Date | undefined {
	const local = value.replace(OFFSET_PATTERN, "");
	const match = LOCAL_PATTERN.exec(local);

	if (!match) return undefined;
	const [year, month, day] = match.slice(1, 4).map(Number);

	const utc = Date.UTC(
		year,
		month - 1,
		day,
		Number(match[4]),
		Number(match[5]),
		Number(match[6] ?? 0)
	);

	// Date.UTC rollt den 31. Februar weiter, statt ihn abzulehnen.
	if (new Date(utc).getUTCDate() !== day || month < 1 || month > 12) {
		return undefined;
	}

	if (OFFSET_PATTERN.test(value)) {
		const date = new Date(value);

		return Number.isNaN(date.getTime()) ? undefined : date;
	}

	const early = utc - berlinOffsetMs(utc - 24 * 3_600_000);
	const late = utc - berlinOffsetMs(utc + 24 * 3_600_000);

	const exact = [early, late].find((instant) => instant + berlinOffsetMs(instant) === utc);

	return new Date(exact ?? early);
}
