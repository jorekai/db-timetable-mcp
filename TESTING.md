# Teststrategie

Die Testpyramide besteht aus schnellen Parser- und Konfigurationstests, MCP-Vertragstests über In-Memory-Transporte und einem echten Streamable-HTTP-Client gegen einen temporären lokalen Server. Externe DB-Aufrufe werden in automatischen Tests nicht ausgeführt.

## Komplette Prüfung

```bash
npm ci
npm run check
npm run test:coverage
npm audit --audit-level=high
```

`npm run check` führt Biome, TypeScript, alle Vitest-Suites und den Produktionsbuild aus. Die Coverage-Grenzen liegen bei 85 % für Zeilen, Funktionen und Statements sowie 80 % für Branches.

## Testbereiche

| Suite | Abdeckung |
|---|---|
| `timetableParser.test.ts` | XML-Validierung, semantische Felder, Zeitstempel, Gleise, Meldungen und Merge-Logik |
| `api.test.ts` | Auth-Header, URL-Kodierung, Fehlerabbildung, Roh-XML-Option und Bahnhofstafel |
| `server.test.ts` | MCP-Toolschemas, strukturierte Ausgaben, Eingabevalidierung und Ressourcen |
| `transport.test.ts` | Healthcheck, stateless Streamable HTTP und Ablehnung des alten SSE-GET-Flows |
| `stdio.e2e.test.ts` | Echter MCP-Handshake mit einem gestarteten stdio-Unterprozess und stderr-Logging |
| `config.test.ts` | `.env`-Auflösung, sichere Netzwerkstandards und Legacy-Migration |
| `utils/*` | Fehlerklassen und stderr-only Logging |

## Manueller MCP-Test

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

Im Inspector zuerst `findStations` mit `Frankfurt` und danach `getStationBoard` mit der gefundenen EVA-Nummer verwenden.

## Streamable HTTP

```bash
MCP_TRANSPORT=http npm start
curl http://127.0.0.1:3000/health
```

Der vollständige MCP-Vertrag wird bereits automatisiert mit dem offiziellen TypeScript-Client getestet. Für Netzwerkdiagnosen kann der Inspector gegen `http://127.0.0.1:3000/mcp` verbunden werden.

## Container

```bash
docker build -t db-timetable-mcp:test .
docker run --rm -d --name db-timetable-mcp-test \
  -p 127.0.0.1:3000:3000 \
  -e DB_TIMETABLE_CLIENT_ID=test \
  -e DB_TIMETABLE_CLIENT_SECRET=test \
  db-timetable-mcp:test
docker inspect --format '{{.State.Health.Status}}' db-timetable-mcp-test
curl http://127.0.0.1:3000/health
docker stop db-timetable-mcp-test
```

## Live-Smoke-Test

Ein Live-Test verbraucht das persönliche API-Kontingent und läuft deshalb bewusst nicht in CI. Mit gültiger `.env` kann `getStationBoard` für EVA `8000105`, das aktuelle Datum im Format `YYMMDD` und eine Stunde `HH` über den Inspector geprüft werden.
