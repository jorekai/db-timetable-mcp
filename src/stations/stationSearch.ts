import type { Station, StationSearchResult } from "../api/types.js";
import { STATION_INDEX } from "./stationIndex.js";

interface SearchEntry {
	station: Station;
	category: number;
	names: string[][];
	ds100: string[];
}

const split = (value: string, separator = ",") =>
	value ? value.split(separator) : [];

/** Gleicht Schreibweisen an: „Frankfurt(Main)Hbf“ und „frankfurt main hbf“. */
function tokens(value: string): string[] {
	return value
		.toLowerCase()
		.replace(/ä/g, "ae")
		.replace(/ö/g, "oe")
		.replace(/ü/g, "ue")
		.replace(/ß/g, "ss")
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/hauptbahnhof/g, "hbf")
		.replace(/strasse/g, "str")
		.split(/[^\p{L}\p{N}]+/u)
		.filter(Boolean);
}

const compact = (value: string) => value.toUpperCase().replace(/\s+/g, "");

let cache: SearchEntry[] | undefined;

/** Erst bei der ersten Suche aufbauen, damit der Serverstart schnell bleibt. */
function entries(): SearchEntry[] {
	cache ??= STATION_INDEX.split("\n").map((line) => {
		const [evas, name, ds100, stada, category, platforms, others] =
			line.split("\t");
		const evaNumbers = split(evas);
		const ds100Codes = split(ds100);
		const otherNames = split(others, "|");
		return {
			station: {
				evaNo: evaNumbers[0],
				evaNumbers,
				ds100Codes,
				...(stada && { stada }),
				name,
				otherNames,
				platforms: split(platforms),
			},
			category: Number(category) || 9,
			names: [name, ...otherNames].map(tokens),
			ds100: ds100Codes.map(compact),
		};
	});
	return cache;
}

/** Kleiner ist besser; `undefined` heißt kein Treffer. */
function rank(
	entry: SearchEntry,
	pattern: string,
	query: string[],
): number | undefined {
	if (entry.station.evaNumbers.includes(pattern)) return 0;
	if (entry.ds100.includes(compact(pattern))) return 1;
	if (query.length === 0) return undefined;
	const joined = query.join("");
	const ranks = entry.names.map((name) => {
		const full = name.join("");
		if (full === joined) return 2;
		if (full.startsWith(joined)) return 3;
		if (query.every((part) => name.some((token) => token.startsWith(part)))) {
			return 4;
		}
		return joined.length >= 3 && full.includes(joined) ? 5 : 9;
	});
	const best = Math.min(...ranks);
	return best === 9 ? undefined : best;
}

export function searchStations(
	pattern: string,
	limit: number,
): StationSearchResult {
	const trimmed = pattern.trim();
	const query = tokens(trimmed);
	const matches = entries()
		.map((entry) => ({ entry, rank: rank(entry, trimmed, query) }))
		.filter((match): match is { entry: SearchEntry; rank: number } =>
			Number.isInteger(match.rank),
		)
		.sort(
			(a, b) =>
				a.rank - b.rank ||
				a.entry.category - b.entry.category ||
				a.entry.station.name.localeCompare(b.entry.station.name, "de"),
		);
	return {
		totalMatches: matches.length,
		stations: matches.slice(0, limit).map((match) => match.entry.station),
	};
}
