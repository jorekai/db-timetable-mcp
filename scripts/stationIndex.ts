import { XMLParser } from "fast-xml-parser";

/** Ein Bahnhof in der Form, in der er in den Index geschrieben wird. */
export interface IndexedStation {
	evaNumbers: string[];
	name: string;
	ds100Codes: string[];
	stada: string;
	category: string;
	platforms: string[];
	otherNames: string[];
}

type XmlNode = Record<string, unknown>;

const START = "<StopPlace ";
const END = "</StopPlace>";
const STADA_TYPE = "https://daten.bahnhof.de/namespace/stada/";

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: "@",
	parseTagValue: false,
	parseAttributeValue: false,
	trimValues: true,
});

function list(value: unknown): unknown[] {
	if (value === undefined || value === "") return [];
	return Array.isArray(value) ? value : [value];
}

function node(value: unknown): XmlNode {
	return value && typeof value === "object" ? (value as XmlNode) : {};
}

function text(value: unknown): string {
	if (typeof value === "string") return value.trim();
	const inline = node(value)["#text"];
	return typeof inline === "string" ? inline.trim() : "";
}

/**
 * Bis 2027-04-01 trägt `Name` den Text doppelt (inline und in `Text`), danach
 * nur noch in `Text`. Deshalb gilt `Text` zuerst, der Inline-Text als Rückfall.
 */
function readNames(value: unknown): { name: string; otherNames: string[] } {
	const name = node(list(value)[0]);
	const variants = list(name.Text).map((entry) => ({
		language: String(node(entry)["@lang"] ?? "de"),
		value: text(entry),
	}));
	const german =
		variants.find((variant) => variant.language === "de")?.value ||
		text(list(value)[0]);
	const otherNames = variants
		.map((variant) => variant.value)
		.filter((variant) => variant && variant !== german);
	return { name: german, otherNames: [...new Set(otherNames)] };
}

function readKeys(place: XmlNode, key: string): string[] {
	return list(node(place.keyList).KeyValue)
		.map(node)
		.filter((entry) => text(entry.Key) === key)
		.map((entry) => text(entry.Value))
		.filter(Boolean);
}

/** Kommende Fassung zuerst (`privateCodes`), danach das alte `PrivateCode`. */
function readStada(place: XmlNode): string {
	const codes = list(node(place.privateCodes).PrivateCode);
	const typed = codes.find((code) => node(code)["@type"] === STADA_TYPE);
	return text(typed ?? list(place.PrivateCode)[0]);
}

function comparePlatforms(left: string, right: string): number {
	return left.localeCompare(right, "de", { numeric: true });
}

function readPlatforms(place: XmlNode): string[] {
	const platforms = list(node(place.quays).Quay)
		.map(node)
		.filter((quay) => text(quay.QuayType) === "railPlatform")
		.map((quay) => text(quay.PlateCode).replace(/^(Gleis|Gl)\s+/, ""))
		.filter(Boolean);
	return [...new Set(platforms)].sort(comparePlatforms);
}

/** Liest einen einzelnen StopPlace; ohne EVA-Nummer ist er nicht abfragbar. */
export function parseStopPlace(xml: string): IndexedStation | undefined {
	const place = node(node(parser.parse(xml)).StopPlace);
	const evaNumbers = readKeys(place, "EVA").filter((eva) =>
		/^\d{7}$/.test(eva),
	);
	const { name, otherNames } = readNames(place.Name);
	if (evaNumbers.length === 0 || !name) return undefined;
	return {
		evaNumbers,
		name,
		ds100Codes: readKeys(place, "RIL").map((code) => code.replace(/\s+/g, " ")),
		stada: readStada(place),
		category: readKeys(place, "DBINFRAGO_STATION_CATEGORY")[0] ?? "",
		platforms: readPlatforms(place),
		otherNames,
	};
}

/**
 * Zerlegt den Export im Strom. Die Datei ist über 300 MB groß und passt nicht
 * sinnvoll als Ganzes in einen XML-Baum.
 */
export async function* splitStopPlaces(
	chunks: AsyncIterable<string>,
): AsyncGenerator<string> {
	let buffer = "";
	for await (const chunk of chunks) {
		buffer += chunk;
		while (true) {
			const start = buffer.indexOf(START);
			if (start < 0) {
				buffer = buffer.slice(-START.length);
				break;
			}
			const end = buffer.indexOf(END, start);
			if (end < 0) {
				buffer = buffer.slice(start);
				break;
			}
			yield buffer.slice(start, end + END.length);
			buffer = buffer.slice(end + END.length);
		}
	}
	if (buffer.includes(START)) {
		throw new Error("Der NeTEx-Export endet mitten in einem StopPlace");
	}
}

function serializeStation(station: IndexedStation): string {
	const fields = [
		station.evaNumbers.join(","),
		station.name,
		station.ds100Codes.join(","),
		station.stada,
		station.category,
		station.platforms.join(","),
		station.otherNames.join("|"),
	];
	if (fields.some((field) => /[\t\n\r]/.test(field))) {
		throw new Error(`Unzulässiges Trennzeichen bei ${station.name}`);
	}
	return fields.join("\t").replace(/[\\`]|\$\{/g, "\\$&");
}

export function renderIndexModule(
	stations: IndexedStation[],
	dataAsOf: string,
): string {
	const lines = [...stations]
		.sort((left, right) =>
			left.evaNumbers[0].localeCompare(right.evaNumbers[0]),
		)
		.map(serializeStation);
	return `// Erzeugt durch \`npm run stations:update\`. Nicht von Hand ändern.
// Quelle: DB InfraGO, OpenStation, NeTEx-Export.
// Spalten: EVA, Name, DS100, Stations-ID, Kategorie, Gleise, weitere Namen

export const STATION_DATA_AS_OF = ${JSON.stringify(dataAsOf)};

export const STATION_INDEX: string = \`${lines.join("\n")}\`;
`;
}
