[English](README.md) | [Deutsch](README.de.md)

# DB Timetable MCP Server

[![CI](https://github.com/jorekai/db-timetable-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jorekai/db-timetable-mcp/actions/workflows/ci.yml)
[![Smithery](https://smithery.ai/badge/@jorekai/db-timetable-mcp)](https://smithery.ai/server/@jorekai/db-timetable-mcp)

Ein produktionsreifer Model Context Protocol Server für die offizielle OpenBoards-API der Deutschen Bahn. Er übersetzt Abfahrten und Ankünfte in semantisches JSON, führt sie zu einer Bahnhofstafel zusammen und bringt für die Stationssuche ein eigenes Verzeichnis deutscher Bahnhöfe mit.

## Warum dieser Server?

- **Korrekte Gleise und Zeiten:** `effective` enthält den tatsächlich anzuzeigenden Wert, `planned` den Sollzustand.
- **LLM-freundlich:** Tools liefern `structuredContent`, beschreibende JSON-Schemas und ein abrufbares Datenmodell.
- **MCP-konform:** Offizielles TypeScript-SDK, stdio für lokale Clients und stateless Streamable HTTP für Remote-Betrieb.
- **Sicherer Betrieb:** Keine Logs auf `stdout`, lokale Bindung als Standard, Host-Allowlist, Timeouts, Non-root-Container und reproduzierbares Lockfile.
- **Nachvollziehbar:** Unit-, Vertrags- und Transporttests, Coverage-Grenzen, CI, Dependency- und Secret-Checks.

## Schnellstart

Voraussetzungen: Node.js 22 oder 24 LTS sowie eine Anwendung mit Abonnement für das Produkt Open Boards im [DB API Marketplace](https://developers.deutschebahn.com/db-api-marketplace/apis/product/open-boards).

```bash
git clone https://github.com/jorekai/db-timetable-mcp.git
cd db-timetable-mcp
npm ci
cp .env.example .env
```

In `.env` eintragen:

```dotenv
DB_TIMETABLE_CLIENT_ID=deine-client-id
DB_TIMETABLE_CLIENT_SECRET=dein-api-key
```

Dann bauen und starten:

```bash
npm run build
npm start
```

Im stdio-Modus wartet der Prozess auf einen MCP-Client. Statusmeldungen gehen ausschließlich nach `stderr`; `stdout` bleibt für JSON-RPC reserviert.

## Claude Desktop

Zuerst `npm ci && npm run build` ausführen. Anschließend einen absoluten Pfad in `claude_desktop_config.json` verwenden.

macOS/Linux:

```json
{
  "mcpServers": {
    "db-timetable": {
      "command": "node",
      "args": ["/absolute/path/db-timetable-mcp/dist/index.js"]
    }
  }
}
```

Windows:

```json
{
  "mcpServers": {
    "db-timetable": {
      "command": "node",
      "args": ["C:\\absolute\\path\\db-timetable-mcp\\dist\\index.js"]
    }
  }
}
```

Die `.env`-Datei wird sowohl im aktuellen Arbeitsverzeichnis als auch neben dem Projektverzeichnis gesucht. Das funktioniert auch dann, wenn Claude Desktop den kompilierten Server aus einem anderen Arbeitsverzeichnis startet. Alternativ können die beiden Zugangsdaten im `env`-Objekt des MCP-Eintrags gesetzt werden.

Nach einer Konfigurationsänderung Claude Desktop vollständig beenden und neu starten. Weitere Hinweise stehen unter [Fehlerbehebung](#fehlerbehebung).

## Tools

| Tool | Zweck |
|---|---|
| `getDepartures` | Abfahrten einer Station in einem Zeitfenster |
| `getArrivals` | Ankünfte einer Station in einem Zeitfenster |
| `getStationBoard` | Beide Richtungen, je Zughalt zusammengeführt |
| `findStations` | Lokale Stationssuche nach Name, EVA-Nummer oder DS100-Code |

Die vollständige Referenz mit Beispielen steht in [docs/api.md](docs/api.md).

### Umstieg von Version 2

Version 3 ersetzt die Timetables-API durch OpenBoards. Dafür ist ein Open-Boards-Abonnement nötig.

| Version 2 | Version 3 |
|---|---|
| `getPlannedTimetable` | `getDepartures`, `getArrivals` oder `getStationBoard`; `planned` lesen |
| `getCurrentTimetable`, `getRecentChanges` | entfallen; Tafel erneut abrufen |
| `date` und `hour` | `startTime` und `durationMinutes` |
| `includeRawXml`, `rawXml` | entfallen |
| `changed` | entfällt; `effective` lesen |
| `ds100`, `metaStations` in `findStations` | `ds100Codes`, `evaNumbers` |

Zeigt `DB_TIMETABLE_BASE_URL` noch auf die Timetables-API, bricht der Server mit einer Erklärung ab.

## Datenmodell

Ein Ereignis für Ankunft oder Abfahrt sieht verkürzt so aus:

```json
{
  "planned": { "time": { "local": "2026-07-17T10:20" }, "platform": "8" },
  "effective": { "time": { "local": "2026-07-17T10:27" }, "platform": "10" },
  "timeType": "PREVIEW",
  "delayMinutes": 7,
  "platformChanged": true,
  "isCancelled": false
}
```

Für Antworten an Reisende immer `effective` verwenden. Das Modell kann dieselbe Erklärung über die Ressource `db-timetable://docs/data-model` abrufen. Details: [docs/data-model.md](docs/data-model.md).

## Streamable HTTP und Docker

Direkt lokal starten:

```bash
MCP_TRANSPORT=http npm start
```

- MCP-Endpunkt: `http://127.0.0.1:3000/mcp`
- Healthcheck: `http://127.0.0.1:3000/health`

Mit Docker Compose:

```bash
docker compose up --build -d
docker compose ps
curl http://127.0.0.1:3000/health
```

Compose bindet den Port absichtlich nur an Loopback, startet als nicht privilegierter Benutzer und verwendet ein schreibgeschütztes Dateisystem. Für einen öffentlichen Endpunkt sind zusätzlich TLS und Authentifizierung über einen Reverse Proxy erforderlich. `ALLOWED_HOSTS` muss alle erlaubten Hostnamen enthalten.

## Konfiguration

| Variable | Standard | Beschreibung |
|---|---:|---|
| `DB_TIMETABLE_CLIENT_ID` | – | DB-Client-ID, für API-Aufrufe erforderlich |
| `DB_TIMETABLE_CLIENT_SECRET` | – | DB-API-Key, für API-Aufrufe erforderlich |
| `DB_TIMETABLE_BASE_URL` | OpenBoards-v1-URL | Alternative Basis-URL, primär für Tests |
| `DB_TIMETABLE_TIMEOUT_MS` | `15000` | Request-Timeout zwischen 1000 und 120000 ms |
| `MCP_TRANSPORT` | `stdio` | `stdio` oder `http` |
| `HOST` | `127.0.0.1` | HTTP-Bindeadresse |
| `PORT` | `3000` | HTTP-Port |
| `MCP_ENDPOINT` | `/mcp` | Streamable-HTTP-Pfad |
| `ALLOWED_HOSTS` | – | Kommaseparierte Host-Allowlist; bei `0.0.0.0`/`::` verpflichtend |
| `DOTENV_CONFIG_PATH` | – | Expliziter absoluter Pfad zu einer Env-Datei |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` oder `error` |

Die alten Werte `TRANSPORT_TYPE=sse|httpStream` und `SSE_ENDPOINT` werden für eine sanfte Migration weiterhin auf Streamable HTTP abgebildet.

## Entwicklung

```bash
npm run dev          # stdio mit Watch-Modus
npm run dev:http     # Streamable HTTP mit Watch-Modus
npm run check        # Lint, Typen, Tests und Build
npm run test:coverage
npm run stations:update   # Bahnhofsverzeichnis aus dem aktuellen NeTEx-Export neu bauen
```

Weitere Dokumente:

- [API-Referenz](docs/api.md)
- [Datenmodell](docs/data-model.md)
- [Architektur](docs/architecture.md)
- [Teststrategie](TESTING.md)
- [Beitragen](CONTRIBUTING.md)
- [Sicherheitsrichtlinie](SECURITY.md)
- [Änderungshistorie](CHANGELOG.md)

## Fehlerbehebung

**`Expected "," or "]" after array element` in Claude Desktop**

Auf Version 2 aktualisieren und neu bauen. Frühere Versionen schrieben Logzeilen auf den stdio-Protokollkanal; Version 2 nutzt dafür ausschließlich `stderr`.

**`DB-API-Zugangsdaten fehlen` trotz `.env`**

Die Datei muss im Repository-Root neben `package.json` liegen. Bei einem anderen Ort `DOTENV_CONFIG_PATH` absolut setzen. Keine Anführungszeichen oder zusätzlichen Leerzeichen um die Werte verwenden.

**401/403 von der DB API**

Prüfen, ob Client-ID und API-Key zusammengehören und die Anwendung das Produkt Open Boards abonniert hat. Ein Abonnement des alten Produkts Timetables genügt nicht. Die Fehlermeldung gibt den Grund des API-Gateways wieder, z. B. `Cannot find valid subscription`.

**Falsches Gleis**

`effective.platform` lesen. `planned.platform` ist ausdrücklich das Sollgleis. `platformChanged` sagt, ob beide voneinander abweichen.

## Datenquelle und Lizenz

Die Fahrplandaten stammen von der Deutschen Bahn und werden über die [OpenBoards-API](https://developers.deutschebahn.com/db-api-marketplace/apis/product/open-boards) bereitgestellt. Der Plan Free erlaubt 10 Anfragen pro Sekunde (Stand November 2026). Anders als bei der Timetables API nennt die Produktseite nicht CC BY 4.0. Sie verweist auf die [Nutzungsbedingungen der Web-Bahnhofstafel](https://db.info/bahnhof-de/nutzungsbedingungen_wbt.html), die gewerbliche Nutzung und Weitergabe einschränken. Vor dem Betrieb eines öffentlichen Dienstes lesen.

Das Bahnhofsverzeichnis in `src/stations/stationIndex.ts` ist aus dem [NeTEx-Export von OpenStation](https://www.bahnhof.de/daten/netex) der DB InfraGO abgeleitet, veröffentlicht über Mobilithek. `dataAsOf` nennt in jedem Ergebnis von `findStations` den Stand. Enthalten sind Bahnhöfe der DB InfraGO; Stationen anderer Betreiber können fehlen. Eine bekannte EVA-Nummer lässt sich trotzdem abfragen.

Der MCP-Server selbst steht unter der [MIT-Lizenz](LICENSE.md).
