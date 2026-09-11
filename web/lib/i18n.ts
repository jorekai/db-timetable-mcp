/*
 * Zweisprachige UI-Texte (EN/DE). Die Artefakte des Projekts sind englisch,
 * die Erklärseite richtet sich an deutsche Bahnfahrende, deshalb gibt es
 * beide Sprachen mit Umschalter. Code-Kommentare bleiben deutsch.
 *
 * Inline-Code wird mit Backticks markiert und von <RichText> als <code>
 * gerendert. Platzhalter stehen in {geschweiften Klammern} und werden über
 * `format()` ersetzt.
 */

import { defaultLocale, isLocale, type Locale, locales } from "./locales";

export type { Locale };
export { defaultLocale, isLocale, locales };

const en = {
	meta: {
		title: "DB Timetables MCP · browser demo",
		description:
			"A real MCP client in the browser, talking Streamable HTTP to a Cloudflare Worker that runs the DB Timetables MCP server.",
	},
	header: {
		brand: "DB Timetables MCP",
		tag: "browser demo",
		navBoard: "Board",
		navProtocol: "Protocol",
		navAbout: "How it works",
		language: "Language",
		switchTo: "Switch to German",
	},
	lede: {
		lead: "This page is a real `MCP` client running in your browser.",
		body: "It speaks raw JSON-RPC over Streamable HTTP to a Cloudflare Worker that runs the `db-timetable-mcp` server and holds the DB API credentials. There is no REST wrapper in between. Open the protocol log to read the exact bytes.",
		stateless:
			"The worker is stateless: every call stands on its own, there is no session id, and `GET` and `DELETE` are answered with `405`.",
	},
	board: {
		heading: "Live board",
		intro:
			"Search a station, then watch the departures the worker merges from the planned timetable and the realtime changes.",
		searchLabel: "Station",
		searchPlaceholder: "Frankfurt Hbf, Köln, 8000105",
		searchButton: "Search",
		examplesLabel: "Try",
		examples: ["Frankfurt Hbf", "Köln Hbf", "Berlin Hbf", "8000105"],
		status: {
			searching: "Searching stations…",
			found: "{count} station(s) found. Pick one.",
			noMatch:
				"No station matched. Try a city name, a station name, or an EVA number.",
			loading: "Loading the board for {name}…",
			ready: "",
		},
		station: {
			eva: "EVA {eva}",
		},
		title: "{name} · EVA {eva}",
		meta: {
			dataFrom: "data from {time} ({age} s old)",
			fromCache: "served from the worker cache",
			fromUpstream: "fetched upstream",
			upstreamCalls: "{count} upstream call(s) for this board",
			hiddenArrivals: "{count} arrival(s) not shown",
			hoursLoaded: "{count} hour(s) loaded",
			stale:
				"Stale: the upstream quota is exhausted, showing the last snapshot.",
		},
		refresh: {
			autoRefresh: "Auto refresh",
			paused: "Paused",
			nextIn: "Next update in {seconds} s",
			refreshNow: "Refresh now",
			pause: "Pause",
			resume: "Resume",
			stalePaused:
				"Auto refresh paused: the worker is serving a cached snapshot.",
		},
		columns: {
			time: "Departure",
			line: "Line",
			destination: "Destination",
			status: "Status",
		},
		status_: {
			onTime: "on time",
			cancelled: "cancelled",
			delay: "+{minutes} min",
			early: "{minutes} min",
			noRealtime: "no realtime data",
			platformChanged: "platform {from} → {to}",
			platform: "platform {platform}",
		},
		time: {
			effective: "effective",
			planned: "planned",
			changed: "changed",
			changedNone: "none",
		},
		messages: {
			summary: "Messages",
			none: "No messages for this stop.",
		},
		empty: {
			title: "No departures in the loaded window.",
			hint: "The board covers the current hour. If this hour is quiet, the next refresh picks up the following one automatically.",
		},
		errors: {
			rateLimited:
				"Rate limited by the demo worker. Wait {seconds} s before trying again. Reloading makes it worse.",
			upstream:
				"This is the demo's shared upstream quota, not your connection. The board will recover when the quota resets.",
			configuration:
				"No worker endpoint is configured. Set `MCP_ENDPOINT` in `lib/config.ts`, or open this page with `?endpoint=https://…/mcp`.",
			generic:
				"Could not reach the worker at {endpoint}. Check the URL and that this origin is allowed by CORS.",
		},
	},
	protocol: {
		heading: "Protocol log",
		intro:
			"Every JSON-RPC message this page exchanged with the worker, in order. Open one to read its bytes and what it does. Oversized timetable payloads are shortened for the browser and marked as truncated.",
		show: "Show messages",
		hide: "Hide messages",
		count: "{count} message(s) recorded",
		empty: "No messages yet. Run a search to start the handshake.",
		sent: "sent",
		received: "received",
		truncated: "Shortened for display: {bytes} bytes originating.",
		meaning: {
			initialize:
				"The client introduces itself and proposes a protocol version. The server answers with the version it will speak.",
			initialized:
				"A notification, not a request: it has no id and gets no reply. The client tells the server it is ready.",
			toolsList:
				"The server names its tools and publishes their input schemas. Here you can see that `getStationBoard` wants an `evaNo`, a `date`, and an `hour`.",
			toolsCall:
				"The actual call. The result carries both `content` (a JSON string for the model) and `structuredContent` (the same data as an object for programs).",
		},
		cacheHeading: "Cache state",
		cache: {
			hit: "Cache hit",
			miss: "Fetched upstream",
			unknown: "No data yet",
			upstreamCalls: "{count} upstream call(s) this response",
			age: "{age} s old",
			stale: "Serving a stale snapshot",
			explain:
				"These values come from additive HTTP headers (`X-MCP-Cache`, `X-MCP-Upstream-Calls`, `X-MCP-Cache-Stale`, `X-MCP-Retrieved-At`), so the tool contract itself stays unchanged.",
		},
		toolsHeading: "Tools advertised by the server",
		toolsEmpty: "Run a search to fetch `tools/list`.",
	},
	about: {
		mcp: {
			heading: "What is MCP?",
			p1: "MCP, the Model Context Protocol, is a way for one program to call the tools of another without either side knowing how the other is built. This page is one program. The worker is the other.",
			p2: "Here the browser calls five tools by name and receives structured JSON. It sees Deutsche Bahn's timetable data. It never sees the DB API credentials: those stay on the server.",
			p3: "That is the point of the pattern. The credentials and the quota live with the server. The client only asks for a result.",
		},
		time: {
			heading: "Three versions of the same moment",
			intro:
				"Every arrival and departure carries up to three versions of the same time. This is the part most displays throw away.",
			planned: "The original timetable. What the operator intended to run.",
			changed:
				"Only the deviations that were reported later. Fields that did not change are simply absent.",
			effective:
				"The value to display: the change where there is one, otherwise the plan. When a train is on time, `changed` is missing and `effective` equals `planned`. That absence is the message, not a gap.",
		},
		credentials: {
			heading: "Where are the credentials?",
			p1: "The DB API credentials live as a Cloudflare Worker secret. They are never sent to the browser and never committed to this repository.",
			p2: "CORS is the boundary. The worker answers only the exact origins on its allowlist, so another site cannot spend this account's quota by pointing at the worker.",
		},
		cache: {
			heading: "Why one board does not cost one call",
			p1: "A single board needs up to two upstream requests. Ten visitors within thirty seconds still need two. The worker caches the upstream responses, so everyone after the first reads the cache.",
			p2: "The windows are 30 seconds for live data, one hour for the planned timetable, and 24 hours for station data.",
			p3: "When the DB quota is exhausted or the API fails, the worker returns the last snapshot for up to six hours and marks it stale. An old board is better than an error page, as long as it says so.",
		},
		tools: {
			heading: "The five tools",
			intro:
				"For a station board, always use `getStationBoard`. It merges the plan and the realtime changes in one call.",
			stationBoard:
				"getStationBoard: the merged board for one station and one hour. Use `effective` for times and platforms.",
			planned:
				"getPlannedTimetable: the static plan for a station, day, and hour. No realtime changes.",
			current:
				"getCurrentTimetable: the full set of known changes. This is change data, not a finished board.",
			recent:
				"getRecentChanges: only the changes reported in the last two minutes. A delta for frequent updates, not a board on its own.",
			stations:
				"findStations: search stations by name, EVA number, or DS100 code.",
			resources:
				"Alongside the tools the server exposes four resource templates: `db-api:timetable/current/{evaNo}`, `db-api:timetable/changes/{evaNo}`, `db-api:timetable/planned/{evaNo}/{date}/{hour}`, and `db-api:station/{pattern}`.",
		},
		limits: {
			heading: "Limits",
			intro:
				"The operator's DB API quota is personal and small. The cache and the circuit breaker are what keep a popular page from burning it.",
			columns: ["Resource", "Limit", "Effect"],
			rows: [
				[
					"Live data cache",
					"30 s",
					"One upstream call per station board per window, regardless of visitors.",
				],
				[
					"Planned timetable cache",
					"1 h",
					"Timetables for a station, day, and hour are static within the hour.",
				],
				[
					"Station data cache",
					"24 h",
					"Station records effectively never change.",
				],
				[
					"Stale window",
					"6 h",
					"If the quota is exhausted, the last snapshot is served and marked stale.",
				],
				[
					"Rate limit per visitor",
					"20 / min, 200 / h",
					"HTTP 429 with `Retry-After`. Best effort, in worker memory only.",
				],
				[
					"Circuit breaker",
					"30 s",
					"After an upstream 429, no further upstream calls are attempted for 30 s.",
				],
			],
		},
	},
	attribution: {
		heading: "Data source and attribution",
		p1: "Timetable data is provided by Deutsche Bahn via the DB API Marketplace and is licensed under the Creative Commons Attribution 4.0 International licence (CC BY 4.0).",
		line: "Contains timetable data of Deutsche Bahn AG, licensed under CC BY 4.0. Source: DB API Marketplace, Timetables API.",
		note: "Attribution is a condition of the licence, not a courtesy. This page is not affiliated with or endorsed by Deutsche Bahn AG.",
	},
	privacy: {
		heading: "Privacy",
		items: [
			"No cookies, no analytics, no tracking pixels, no third-party requests. All assets come from this origin.",
			"Your station searches are not stored. The worker answers and forgets.",
			"The worker uses your IP address in memory only, to count requests against the rate limit. Counters are never written to storage or logs.",
			"The worker logs the upstream path it fetched, for example `/plan/8000105/260910/16`, so the cache can be verified. It does not log your IP or the content of your requests.",
			"Cloudflare and Vercel process requests as hosting providers and may keep operational logs.",
		],
	},
	footer: {
		note: "MCP server under MIT, timetable data under CC BY 4.0. No cookies, no tracking.",
		source: "Source",
	},
};

export type Dictionary = typeof en;

const de: Dictionary = {
	meta: {
		title: "DB Fahrplan MCP · Browser-Demo",
		description:
			"Ein echter MCP-Client im Browser, der per Streamable HTTP mit einem Cloudflare Worker spricht, der den DB-Fahrplan-MCP-Server ausführt.",
	},
	header: {
		brand: "DB Fahrplan MCP",
		tag: "Browser-Demo",
		navBoard: "Tafel",
		navProtocol: "Protokoll",
		navAbout: "So funktioniert es",
		language: "Sprache",
		switchTo: "Auf Englisch umschalten",
	},
	lede: {
		lead: "Diese Seite ist ein echter `MCP`-Client, der im Browser läuft.",
		body: "Er spricht rohes JSON-RPC über Streamable HTTP mit einem Cloudflare Worker, der den `db-timetable-mcp`-Server ausführt und die Zugangsdaten hält. Dazwischen liegt kein REST-Wrapper. Im Protokoll lässt sich jede Nachricht im Original lesen.",
		stateless:
			"Der Worker ist zustandslos: jeder Aufruf steht für sich, es gibt keine Session-ID, und `GET` sowie `DELETE` werden mit `405` beantwortet.",
	},
	board: {
		heading: "Live-Tafel",
		intro:
			"Bahnhof suchen, dann die Abfahrten beobachten, die der Worker aus Sollfahrplan und Echtzeitänderungen zusammenführt.",
		searchLabel: "Bahnhof",
		searchPlaceholder: "Frankfurt Hbf, Köln, 8000105",
		searchButton: "Suchen",
		examplesLabel: "Beispiele",
		examples: ["Frankfurt Hbf", "Köln Hbf", "Berlin Hbf", "8000105"],
		status: {
			searching: "Bahnhöfe werden gesucht…",
			found: "{count} Bahnhof/Bahnhöfe gefunden. Bitte auswählen.",
			noMatch:
				"Kein Bahnhof gefunden. Versuche einen Ortsnamen, einen Bahnhofsnamen oder eine EVA-Nummer.",
			loading: "Tafel für {name} wird geladen…",
			ready: "",
		},
		station: {
			eva: "EVA {eva}",
		},
		title: "{name} · EVA {eva}",
		meta: {
			dataFrom: "Datenstand {time} ({age} s alt)",
			fromCache: "aus dem Cache des Workers",
			fromUpstream: "frisch vom Upstream",
			upstreamCalls: "{count} Upstream-Aufruf(e) für diese Tafel",
			hiddenArrivals: "{count} Ankunft/Ankünfte nicht angezeigt",
			hoursLoaded: "{count} Stunde(n) geladen",
			stale:
				"Veraltet: das Upstream-Kontingent ist erschöpft, es wird der letzte Stand gezeigt.",
		},
		refresh: {
			autoRefresh: "Automatisch aktualisieren",
			paused: "Pausiert",
			nextIn: "Nächste Aktualisierung in {seconds} s",
			refreshNow: "Jetzt aktualisieren",
			pause: "Pause",
			resume: "Fortsetzen",
			stalePaused:
				"Automatische Aktualisierung pausiert: der Worker liefert einen zwischengespeicherten Stand.",
		},
		columns: {
			time: "Abfahrt",
			line: "Linie",
			destination: "Ziel",
			status: "Zustand",
		},
		status_: {
			onTime: "pünktlich",
			cancelled: "Ausfall",
			delay: "+{minutes} min",
			early: "{minutes} min",
			noRealtime: "keine Echtzeitdaten",
			platformChanged: "Gleis {from} → {to}",
			platform: "Gleis {platform}",
		},
		time: {
			effective: "effective",
			planned: "planned",
			changed: "changed",
			changedNone: "keine",
		},
		messages: {
			summary: "Meldungen",
			none: "Keine Meldungen zu diesem Halt.",
		},
		empty: {
			title: "Im geladenen Fenster keine Abfahrten.",
			hint: "Die Tafel deckt die aktuelle Stunde ab. Ist diese ruhig, holt die nächste Aktualisierung automatisch die folgende Stunde.",
		},
		errors: {
			rateLimited:
				"Der Demo-Worker begrenzt die Anfragen. Bitte {seconds} s warten. Neu laden verschlimmert es.",
			upstream:
				"Das ist das gemeinsame Upstream-Kontingent der Demo, nicht deine Verbindung. Die Tafel erholt sich, sobald das Kontingent zurückgesetzt ist.",
			configuration:
				"Kein Worker-Endpunkt konfiguriert. Setze `MCP_ENDPOINT` in `lib/config.ts` oder öffne die Seite mit `?endpoint=https://…/mcp`.",
			generic:
				"Der Worker unter {endpoint} ist nicht erreichbar. Prüfe die URL und ob diese Origin per CORS erlaubt ist.",
		},
	},
	protocol: {
		heading: "Protokoll",
		intro:
			"Jede JSON-RPC-Nachricht, die diese Seite mit dem Worker ausgetauscht hat, in Reihenfolge. Zum Lesen der Bytes und ihrer Bedeutung aufklappen. Überlange Fahrplan-Antworten werden für den Browser gekürzt und als gekürzt markiert.",
		show: "Nachrichten anzeigen",
		hide: "Nachrichten ausblenden",
		count: "{count} Nachricht(en) aufgezeichnet",
		empty: "Noch keine Nachrichten. Eine Suche startet den Handshake.",
		sent: "gesendet",
		received: "empfangen",
		truncated: "Für die Anzeige gekürzt: ursprünglich {bytes} Bytes.",
		meaning: {
			initialize:
				"Der Client stellt sich vor und schlägt eine Protokollversion vor. Der Server antwortet mit der Version, die er spricht.",
			initialized:
				"Eine Notification, keine Anfrage: ohne `id`, ohne Antwort. Der Client meldet, dass er bereit ist.",
			toolsList:
				"Der Server nennt seine Werkzeuge und veröffentlicht ihre Eingabeschemata. Hier sieht man, dass `getStationBoard` eine `evaNo`, ein `date` und eine `hour` will.",
			toolsCall:
				"Der eigentliche Aufruf. Das Ergebnis trägt sowohl `content` (ein JSON-String für das Modell) als auch `structuredContent` (dieselben Daten als Objekt für Programme).",
		},
		cacheHeading: "Cache-Zustand",
		cache: {
			hit: "Cache-Treffer",
			miss: "Frisch vom Upstream",
			unknown: "Noch keine Daten",
			upstreamCalls: "{count} Upstream-Aufruf(e) in dieser Antwort",
			age: "{age} s alt",
			stale: "Es wird ein veralteter Stand ausgeliefert",
			explain:
				"Diese Werte stammen aus additiven HTTP-Headern (`X-MCP-Cache`, `X-MCP-Upstream-Calls`, `X-MCP-Cache-Stale`, `X-MCP-Retrieved-At`). Der Tool-Vertrag selbst bleibt dadurch unverändert.",
		},
		toolsHeading: "Werkzeuge, die der Server anbietet",
		toolsEmpty: "Eine Suche holt `tools/list`.",
	},
	about: {
		mcp: {
			heading: "Was ist MCP?",
			p1: "MCP, das Model Context Protocol, ist ein Weg für ein Programm, die Werkzeuge eines anderen aufzurufen, ohne dass beide wissen müssen, wie das jeweils andere gebaut ist. Diese Seite ist das eine Programm. Der Worker ist das andere.",
			p2: "Der Browser ruft hier fünf Werkzeuge namentlich auf und erhält strukturiertes JSON. Er sieht die Fahrplandaten der Deutschen Bahn. Er sieht nie die Zugangsdaten der DB-API; die bleiben auf dem Server.",
			p3: "Das ist der Sinn des Musters. Zugangsdaten und Kontingent liegen beim Server. Der Client fragt nur nach einem Ergebnis.",
		},
		time: {
			heading: "Drei Fassungen desselben Moments",
			intro:
				"Ankunft und Abfahrt tragen bis zu drei Fassungen derselben Zeit. Genau diesen Teil verwerfen die meisten Anzeigen.",
			planned:
				"Der ursprüngliche Sollfahrplan. Was der Betreiber fahren wollte.",
			changed:
				"Nur die später gemeldeten Abweichungen. Unveränderte Felder fehlen schlicht.",
			effective:
				"Der anzuzeigende Wert: die Änderung, wo es eine gibt, sonst der Sollwert. Ist ein Zug pünktlich, fehlt `changed` und `effective` gleicht `planned`. Dieses Fehlen ist die Aussage, keine Lücke.",
		},
		credentials: {
			heading: "Wo sind die Zugangsdaten?",
			p1: "Die Zugangsdaten der DB-API liegen als Cloudflare-Worker-Secret. Sie werden nie an den Browser gesendet und nie in dieses Repository geschrieben.",
			p2: "CORS ist die Grenze. Der Worker antwortet nur den exakten Origins seiner Allowlist, damit eine fremde Seite nicht über den Worker das Kontingent dieses Kontos verbrauchen kann.",
		},
		cache: {
			heading: "Warum eine Tafel keinen Aufruf kostet",
			p1: "Eine einzelne Tafel braucht bis zu zwei Upstream-Anfragen. Zehn Besucher innerhalb von dreißig Sekunden brauchen weiterhin zwei. Der Worker cached die Upstream-Antworten, alle späteren lesen aus dem Cache.",
			p2: "Die Fenster sind 30 Sekunden für Live-Daten, eine Stunde für den Sollfahrplan und 24 Stunden für Stationsdaten.",
			p3: "Ist das DB-Kontingent erschöpft oder die API gestört, liefert der Worker bis zu sechs Stunden lang den letzten Stand und markiert ihn als veraltet. Eine alte Tafel ist besser als eine Fehlerseite, solange sie es sagt.",
		},
		tools: {
			heading: "Die fünf Werkzeuge",
			intro:
				"Für eine Bahnhofstafel immer `getStationBoard` nehmen. Es führt Plan und Echtzeitänderungen in einem Aufruf zusammen.",
			stationBoard:
				"getStationBoard: die zusammengeführte Tafel für einen Bahnhof und eine Stunde. Für Zeiten und Gleise `effective` verwenden.",
			planned:
				"getPlannedTimetable: der statische Sollfahrplan für Bahnhof, Tag und Stunde. Ohne Echtzeitänderungen.",
			current:
				"getCurrentTimetable: der vollständige Bestand bekannter Änderungen. Das sind Änderungsdaten, keine fertige Tafel.",
			recent:
				"getRecentChanges: nur die Änderungen der letzten zwei Minuten. Ein Delta für häufige Aktualisierungen, keine Tafel für sich.",
			stations:
				"findStations: Bahnhöfe nach Name, EVA-Nummer oder DS100-Code suchen.",
			resources:
				"Neben den Werkzeugen bietet der Server vier Resource-Templates: `db-api:timetable/current/{evaNo}`, `db-api:timetable/changes/{evaNo}`, `db-api:timetable/planned/{evaNo}/{date}/{hour}` und `db-api:station/{pattern}`.",
		},
		limits: {
			heading: "Grenzen",
			intro:
				"Das DB-API-Kontingent des Betreibers ist persönlich und klein. Cache und Circuit Breaker halten eine gut besuchte Seite davon ab, es zu verbrennen.",
			columns: ["Ressource", "Grenze", "Verhalten"],
			rows: [
				[
					"Live-Daten im Cache",
					"30 s",
					"Ein Upstream-Aufruf pro Bahnhofstafel und Fenster, unabhängig von der Besucherzahl.",
				],
				[
					"Sollfahrplan im Cache",
					"1 h",
					"Fahrpläne für Bahnhof, Tag und Stunde sind innerhalb der Stunde statisch.",
				],
				[
					"Stationsdaten im Cache",
					"24 h",
					"Stationsdatensätze ändern sich praktisch nie.",
				],
				[
					"Veraltet-Fenster",
					"6 h",
					"Ist das Kontingent erschöpft, wird der letzte Stand ausgeliefert und als veraltet markiert.",
				],
				[
					"Rate-Limit pro Besucher",
					"20 / min, 200 / h",
					"HTTP 429 mit `Retry-After`. Best effort, nur im Speicher des Workers.",
				],
				[
					"Circuit Breaker",
					"30 s",
					"Nach einem Upstream-429 werden 30 s lang keine weiteren Upstream-Aufrufe versucht.",
				],
			],
		},
	},
	attribution: {
		heading: "Datenquelle und Namensnennung",
		p1: "Die Fahrplandaten stammen von der Deutschen Bahn über den DB API Marketplace und stehen unter der Creative Commons Attribution 4.0 International Lizenz (CC BY 4.0).",
		line: "Enthält Fahrplandaten der Deutschen Bahn AG, lizenziert unter CC BY 4.0. Quelle: DB API Marketplace, Timetables API.",
		note: "Die Namensnennung ist Lizenzbedingung, keine Höflichkeit. Diese Seite ist mit der Deutschen Bahn AG weder verbunden noch von ihr gebilligt.",
	},
	privacy: {
		heading: "Datenschutz",
		items: [
			"Keine Cookies, keine Analytics, keine Tracking-Pixel, keine Drittanbieter-Anfragen. Alle Assets kommen von dieser Origin.",
			"Deine Bahnhofssuchen werden nicht gespeichert. Der Worker antwortet und vergisst.",
			"Der Worker nutzt deine IP-Adresse nur im Speicher, um Anfragen gegen das Rate-Limit zu zählen. Zähler werden nie gespeichert oder protokolliert.",
			"Der Worker protokolliert den abgerufenen Upstream-Pfad, etwa `/plan/8000105/260910/16`, damit der Cache prüfbar ist. Er protokolliert weder deine IP noch den Inhalt deiner Anfragen.",
			"Cloudflare und Vercel verarbeiten Anfragen als Hoster und können Betriebsprotokolle führen.",
		],
	},
	footer: {
		note: "MCP-Server unter MIT, Fahrplandaten unter CC BY 4.0. Keine Cookies, kein Tracking.",
		source: "Quellcode",
	},
};

export const dictionaries: Record<Locale, Dictionary> = { en, de };

export function getDictionary(locale: Locale): Dictionary {
	return dictionaries[locale];
}

/** Ersetzt {platzhalter} durch die übergebenen Werte. */
export function format(
	template: string,
	values: Record<string, string | number>,
): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) => {
		const value = values[key];
		return value === undefined ? match : String(value);
	});
}
