# Changelog

All notable changes to this project are documented here.

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
