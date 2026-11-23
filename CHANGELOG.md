# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [3.0.0] - 2026-11-23

The server now uses the OpenBoards API instead of the Timetables API. It needs a
subscription to the Open Boards product in the DB API Marketplace.

### Added

- `getDepartures` and `getArrivals` with a free time window of up to eight hours
  and filters for platforms and transport types.
- A bundled station index built from the OpenStation NeTEx export
  (`npm run stations:update`). `findStations` needs no credentials any more.
- The error codes `INVALID_INPUT` and `API_INVALID_RESPONSE`.
- A package `exports` map, so the server, the API client, `serverInfo`, and the
  error helpers can be imported by name rather than by a relative path.

### Changed

- **Breaking:** `getStationBoard` takes `startTime` and `durationMinutes` instead
  of `date` and `hour`, and returns `stops` in the OpenBoards-based data model.
- **Breaking:** `findStations` returns `ds100Codes` and `evaNumbers` instead of
  `ds100` and `metaStations`, plus `totalMatches`.
- **Breaking:** The resources `db-api:timetable/*` are replaced by
  `db-api:board/{evaNo}`, `db-api:departures/{evaNo}`, and `db-api:arrivals/{evaNo}`.
- **Breaking:** The exported `TimetableApi` interface has the methods
  `getStationBoard`, `getDepartures`, `getArrivals`, and `findStations`.
- The server refuses to start when `DB_TIMETABLE_BASE_URL` still points to the
  Timetables API.
- **Licence:** the OpenBoards product page does not state CC BY 4.0. See "Data source and
  license" in the README.
- `tools/call` arguments with more than 1,000 elements are rejected before validation.
- Rejected credentials are reported with the reason given by the API gateway.
- The container image runs on Node.js 26 LTS, and CI also tests it.
- oxlint and oxfmt replace Biome. Git hooks (lefthook), gitleaks, Semgrep, zizmor, and
  knip check the code. This affects contributors only.

### Fixed

- A planned timetable for a future hour is no longer empty
  ([issue 28](https://github.com/jorekai/db-timetable-mcp/issues/28)). `getPlannedTimetable`
  dropped every stop without live data; `getDepartures`, `getArrivals`, and
  `getStationBoard` with `startTime` replace it.
- The container image builds again: `npm ci` no longer runs the `prepare` build before
  the sources are copied.
- Dependencies with published advisories are updated, including the MCP SDK (1.32.2)
  and `body-parser` (2.4.0).

### Removed

- **Breaking:** `getPlannedTimetable`, `getCurrentTimetable`, `getRecentChanges`,
  the `includeRawXml` option, and the `changed` event values.
- The runtime dependency `fast-xml-parser`.
- The Cloudflare Worker, the static browser demo, and the Next.js web app moved
  to a separate private repository. This one holds the server source only.

## [2.0.0] - 2026-07-17

### Added

- Semantic, validated XML parser with documented times, platforms, routes, and messages.
- `getStationBoard` for correctly merging the planned timetable with live changes.
- Structured MCP output, a data model resource, and stateless Streamable HTTP.
- Health check, hardened multi-stage container image, Compose profile, CI, and Dependabot.
- Complete user, API, architecture, security, and test documentation.

### Changed

- Migrated from FastMCP to the official Model Context Protocol TypeScript SDK.
- Node.js 22 or newer is required; the container image uses Node.js 24 LTS.
- API responses are semantic JSON by default; raw XML is available optionally.
- HTTP+SSE was replaced by the current Streamable HTTP transport.

### Fixed

- Log output no longer corrupts the stdio JSON-RPC channel.
- `.env` is found next to the source or `dist` build regardless of the working directory.
- Planned and changed platforms are separated unambiguously and resolved correctly as `effective`.
- Docker builds use `npm ci`, a lockfile, a non-root user, and a health check.

## [1.0.0] - 2025-03-28

### Added

- First version with DB Timetables endpoints as MCP tools and resources.
