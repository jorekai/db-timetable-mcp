# DB Timetable MCP Server

[![CI](https://github.com/jorekai/db-timetable-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jorekai/db-timetable-mcp/actions/workflows/ci.yml)
[![Smithery](https://smithery.ai/badge/@jorekai/db-timetable-mcp)](https://smithery.ai/server/@jorekai/db-timetable-mcp)

Ein produktionsreifer Model Context Protocol Server für die offizielle Deutsche-Bahn-Timetables-API. Er übersetzt das kompakte DB-XML in semantisches JSON und führt Sollfahrplan und Echtzeitänderungen zu einer verlässlichen Bahnhofstafel zusammen.

## Warum dieser Server?

- **Korrekte Gleise und Zeiten:** `effective` enthält den tatsächlich anzuzeigenden Wert; `planned` und `changed` erklären Abweichungen.
- **LLM-freundlich:** Tools liefern `structuredContent`, beschreibende JSON-Schemas und ein abrufbares Datenmodell.
- **MCP-konform:** Offizielles TypeScript-SDK, stdio für lokale Clients und stateless Streamable HTTP für Remote-Betrieb.
- **Sicherer Betrieb:** Keine Logs auf `stdout`, lokale Bindung als Standard, Host-Allowlist, Timeouts, Non-root-Container und reproduzierbares Lockfile.
- **Nachvollziehbar:** Unit-, Vertrags- und Transporttests, Coverage-Grenzen, CI, Dependency- und Secret-Checks.

## Schnellstart

Voraussetzungen: Node.js 22 oder 24 LTS sowie ein abonniertes Timetables-Produkt im [DB API Marketplace](https://developers.deutschebahn.com/db-api-marketplace/apis/product/timetables).

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
| `getStationBoard` | Empfohlen: verbindet Sollfahrplan und vollständige Änderungen zu einer Live-Bahnhofstafel |
| `getPlannedTimetable` | Statischer Sollfahrplan für EVA-Nummer, Datum und Stunde |
| `getCurrentTimetable` | Vollständiger Änderungsbestand (`fchg`); aus Kompatibilitätsgründen so benannt |
| `getRecentChanges` | Änderungen der letzten zwei Minuten (`rchg`) für inkrementelle Aktualisierungen |
| `findStations` | Stationssuche nach Name, EVA-Nummer oder DS100-Code |

Alle Tools akzeptieren optional `includeRawXml: true`. Die vollständige Referenz mit Beispielen steht in [docs/api.md](docs/api.md).

## Datenmodell

Ein Ereignis für Ankunft oder Abfahrt sieht verkürzt so aus:

```json
{
  "planned": { "time": { "local": "2026-07-17T10:20" }, "platform": "8" },
  "changed": { "time": { "local": "2026-07-17T10:27" }, "platform": "10" },
  "effective": { "time": { "local": "2026-07-17T10:27" }, "platform": "10" },
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
| `DB_TIMETABLE_BASE_URL` | offizielle v1-URL | Alternative Basis-URL, primär für Tests |
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

Prüfen, ob Client-ID und API-Key zusammengehören und die Anwendung das Produkt Timetables abonniert hat.

**Falsches Gleis**

`getStationBoard` verwenden und `effective.platform` lesen. `planned.platform` ist ausdrücklich das Sollgleis; `changed.platform` ist nur gesetzt, wenn die DB eine Änderung gemeldet hat.

## Datenquelle und Lizenz

Die Fahrplandaten stammen von der Deutschen Bahn und werden über die [Timetables API 1.0.274](https://developers.deutschebahn.com/db-api-marketplace/apis/product/timetables/api/160160) bereitgestellt. Laut DB API Marketplace stehen die Daten unter [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); die Namensnennung der Deutschen Bahn ist bei Nutzung der Daten erforderlich. Der Marketplace nennt derzeit ein Limit von 60 Aufrufen pro Minute.

Der MCP-Server selbst steht unter der [MIT-Lizenz](LICENSE.md).
