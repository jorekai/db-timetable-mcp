import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
	type IndexedStation,
	parseStopPlace,
	renderIndexModule,
	splitStopPlaces,
} from "./stationIndex.js";

/**
 * Baut src/stations/stationIndex.ts neu auf.
 *
 *   npm run stations:update                  lädt den aktuellen Export (über 300 MB)
 *   npm run stations:update -- <Datei>       liest eine lokale Datei
 */
const EXPORT_URL = "https://www.bahnhof.de/daten/netex";

const TARGET = fileURLToPath(new URL("../src/stations/stationIndex.ts", import.meta.url));

/** Schützt vor einem stillen Austausch durch einen unvollständigen Export. */
const MINIMUM_STATIONS = 5_000;

async function* openExport(file?: string): AsyncGenerator<string> {
	if (file) {
		yield* createReadStream(file, { encoding: "utf8" });

		return;
	}

	const response = await fetch(EXPORT_URL);

	if (!response.ok || !response.body) {
		throw new Error(`NeTEx-Export antwortete mit HTTP ${response.status}`);
	}

	yield* response.body.pipeThrough(new TextDecoderStream());
}

const timestamp: { value?: string } = {};

async function* captureTimestamp(chunks: AsyncIterable<string>): AsyncGenerator<string> {
	let head = "";

	for await (const chunk of chunks) {
		if (!timestamp.value && head.length < 100_000) {
			head += chunk;
			timestamp.value = /<PublicationTimestamp>([^<]+)</.exec(head)?.[1] ?? undefined;
		}

		yield chunk;
	}
}

const stations: IndexedStation[] = [];
let skipped = 0;

for await (const xml of splitStopPlaces(captureTimestamp(openExport(process.argv[2])))) {
	const station = parseStopPlace(xml);

	if (station) stations.push(station);
	else skipped += 1;
}

if (!timestamp.value) throw new Error("PublicationTimestamp fehlt im Export");

if (stations.length < MINIMUM_STATIONS) {
	throw new Error(`Nur ${stations.length} Bahnhöfe gelesen, Abbruch`);
}

await writeFile(TARGET, renderIndexModule(stations, timestamp.value));

console.error(
	`${stations.length} Bahnhöfe geschrieben, ${skipped} ohne EVA-Nummer übersprungen, Stand ${timestamp.value}`
);
