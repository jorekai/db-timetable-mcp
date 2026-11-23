import { describe, expect, test } from "vitest";
import { parseStopPlace, renderIndexModule, splitStopPlaces } from "../../scripts/stationIndex.js";

const keys = (entries: [string, string][]) =>
	`<keyList>${entries.map(([key, value]) => `<KeyValue><Key>${key}</Key><Value>${value}</Value></KeyValue>`).join("")}</keyList>`;

const place = (name: string, codes: string) => `<StopPlace id="x">
${keys([
	["EVA", "8010073"],
	["EVA", "8098073"],
	["RIL", "BCS"],
	["RIL", "BCS  T"],
	["DBINFRAGO_STATION_CATEGORY", "2"],
])}
${codes}${name}
<entrances><Entrance>${keys([["EVA", "9999999"]])}<Name>Eingang</Name></Entrance></entrances>
<quays>
<Quay><QuayType>railPlatform</QuayType><PlateCode>Gleis 10</PlateCode></Quay>
<Quay><QuayType>railPlatform</QuayType><PlateCode>2</PlateCode></Quay>
<Quay><QuayType>railPlatform</QuayType><PlateCode>2</PlateCode></Quay>
<Quay><QuayType>railIslandPlatform</QuayType><PlateCode>B1</PlateCode></Quay>
</quays></StopPlace>`;

const oldForm = place(
	'<Name lang="de">Cottbus &amp; Co<Text lang="de">Cottbus &amp; Co</Text><Text lang="dsb">Chóśebuz</Text></Name>',
	'<privateCodes><PrivateCode type="https://daten.bahnhof.de/namespace/stada/">1077</PrivateCode></privateCodes><PrivateCode>1077</PrivateCode>'
);

const newForm = place(
	'<Name><Text lang="dsb">Chóśebuz</Text><Text lang="de">Cottbus &amp; Co</Text></Name>',
	'<privateCodes><PrivateCode type="other">7</PrivateCode><PrivateCode type="https://daten.bahnhof.de/namespace/stada/">1077</PrivateCode></privateCodes>'
);

const inlineOnly = place(
	'<Name lang="de">Cottbus &amp; Co</Name>',
	"<PrivateCode>1077</PrivateCode>"
);

const expected = {
	evaNumbers: ["8010073", "8098073"],
	name: "Cottbus & Co",
	ds100Codes: ["BCS", "BCS T"],
	stada: "1077",
	category: "2",
	platforms: ["2", "10"],
	otherNames: ["Chóśebuz"],
};

async function* chunked(text: string, size: number) {
	for (let i = 0; i < text.length; i += size) yield text.slice(i, i + size);
}

async function collect(text: string, size: number): Promise<string[]> {
	const result: string[] = [];

	for await (const xml of splitStopPlaces(chunked(text, size))) {
		result.push(xml);
	}

	return result;
}

describe("Aufbau des Bahnhofsverzeichnisses", () => {
	test.each([
		["heutige Form mit Inline-Text und Text", oldForm, expected],
		["Form ab 2027-04-01 nur mit Text", newForm, expected],
		["nur Inline-Text", inlineOnly, { ...expected, otherNames: [] }],
	])("liest einen StopPlace: %s", (_name, xml, station) => {
		expect(parseStopPlace(xml)).toEqual(station);
	});

	test("überspringt Bahnhöfe ohne gültige EVA-Nummer", () => {
		expect(parseStopPlace(oldForm.replace(/8010073|8098073/g, "123"))).toBeUndefined();
	});

	test.each([1, 7, 50, 100_000])("trennt StopPlaces bei Blockgröße %i", async (size) => {
		const xml = `<root><StopPlaceRef ref="a"/>${oldForm}<x/>${newForm}</root>`;
		expect(await collect(xml, size)).toEqual([oldForm, newForm]);
	});

	test("bricht bei einem abgeschnittenen Export ab", async () => {
		await expect(collect(oldForm.slice(0, -5), 64)).rejects.toThrow("mitten in einem StopPlace");
	});

	test("erzeugt ein sortiertes Modul und maskiert Sonderzeichen", () => {
		const module = renderIndexModule(
			[{ ...expected, evaNumbers: ["9000000"], name: "a`b${c}\\d" }, expected],
			"2026-11-23T00:00:00Z"
		);

		const read = new Function(
			`${module.replaceAll("export const", "var").replace(": string", "")}; return STATION_INDEX;`
		);

		const lines: string[] = read().split("\n");
		expect(lines.map((line) => line.split("\t")[1])).toEqual(["Cottbus & Co", "a`b${c}\\d"]);
	});

	test("weist Trennzeichen in Feldern ab", () => {
		expect(() => renderIndexModule([{ ...expected, name: "a\tb" }], "x")).toThrow("Trennzeichen");
	});
});
