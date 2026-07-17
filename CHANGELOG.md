# Changelog

Alle wesentlichen Änderungen dieses Projekts werden hier dokumentiert.

## [2.0.0] - 2026-07-17

### Added

- Semantischer, validierter XML-Parser mit dokumentierten Zeiten, Gleisen, Wegen und Meldungen.
- `getStationBoard` zum korrekten Zusammenführen von Sollfahrplan und Echtzeitänderungen.
- Strukturierte MCP-Ausgaben, Datenmodell-Ressource und stateless Streamable HTTP.
- Healthcheck, gehärtetes Multi-Stage-Containerimage, Compose-Profil, CI und Dependabot.
- Vollständige Benutzer-, API-, Architektur-, Sicherheits- und Testdokumentation.

### Changed

- Migration von FastMCP auf das offizielle Model Context Protocol TypeScript SDK.
- Node.js 22 oder neuer ist erforderlich; das Containerimage verwendet Node.js 24 LTS.
- API-Antworten sind standardmäßig semantisches JSON; Roh-XML ist optional verfügbar.
- HTTP+SSE wurde durch den aktuellen Streamable-HTTP-Transport ersetzt.

### Fixed

- Logausgaben beschädigen den stdio-JSON-RPC-Kanal nicht mehr.
- `.env` wird unabhängig vom Arbeitsverzeichnis neben Source- oder `dist`-Build gefunden.
- Geplante und geänderte Gleise werden eindeutig getrennt und als `effective` korrekt aufgelöst.
- Dockerbuilds verwenden `npm ci`, ein Lockfile, einen Non-root-Benutzer und einen Healthcheck.

## [1.0.0] - 2025-03-28

### Added

- Erste Version mit DB-Timetables-Endpunkten als MCP-Tools und Ressourcen.
