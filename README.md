[English](README.md) | [Deutsch](README.de.md)

# DB Timetable MCP Server

[![CI](https://github.com/jorekai/db-timetable-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/jorekai/db-timetable-mcp/actions/workflows/ci.yml)
[![Smithery](https://smithery.ai/badge/@jorekai/db-timetable-mcp)](https://smithery.ai/server/@jorekai/db-timetable-mcp)

A Model Context Protocol server for the official Deutsche Bahn Timetables API. It converts the compact DB XML into semantic JSON and merges the planned schedule with live changes into one station board.

## What it guarantees

- **Correct platforms and times.** `effective` holds the value to display. `planned` and `changed` explain the deviation.
- **Output built for models.** Tools return `structuredContent`, descriptive JSON schemas, and a data model available as an MCP resource.
- **MCP conformance.** Official TypeScript SDK, stdio for local clients, stateless Streamable HTTP for remote operation.
- **Safe defaults.** No logs on `stdout`, loopback binding unless you change it, host allowlist, timeouts, non-root container, reproducible lockfile.
- **Verifiable behaviour.** Unit, contract, and transport tests, coverage thresholds, CI, dependency and secret checks.

## Quick start

Requirements: Node.js 22 or 24 LTS, and a subscribed Timetables product in the [DB API Marketplace](https://developers.deutschebahn.com/db-api-marketplace/apis/product/timetables).

```bash
git clone https://github.com/jorekai/db-timetable-mcp.git
cd db-timetable-mcp
npm ci
cp .env.example .env
```

Fill in `.env`:

```dotenv
DB_TIMETABLE_CLIENT_ID=deine-client-id
DB_TIMETABLE_CLIENT_SECRET=dein-api-key
```

Then build and start:

```bash
npm run build
npm start
```

In stdio mode the process waits for an MCP client. Status messages go to `stderr` only. `stdout` stays reserved for JSON-RPC.

## Claude Desktop

Run `npm ci && npm run build` first, then point the configuration at an absolute path in `claude_desktop_config.json`.

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

The `.env` file is looked up in the current working directory and next to the project directory, which covers the case where Claude Desktop starts the compiled server from somewhere else. You can also set the two credentials in the `env` object of the MCP entry instead.

After a configuration change, quit Claude Desktop completely and start it again. More in [Troubleshooting](#troubleshooting).

## Tools

| Tool | Purpose |
|---|---|
| `getStationBoard` | Recommended. Joins the planned schedule and the full change set into a live station board |
| `getPlannedTimetable` | Static planned timetable for an EVA number, date, and hour |
| `getCurrentTimetable` | The complete change set (`fchg`), named this way for compatibility |
| `getRecentChanges` | Changes from the last two minutes (`rchg`) for incremental updates |
| `findStations` | Station search by name, EVA number, or DS100 code |

Every tool takes an optional `includeRawXml: true`. The full reference with examples is in [docs/api.md](docs/api.md).

## Data model

An arrival or departure event, abbreviated:

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

Use `effective` for anything a traveller sees. The model can retrieve the same explanation through the `db-timetable://docs/data-model` resource. Details in [docs/data-model.md](docs/data-model.md).

## Streamable HTTP and Docker

Start it locally:

```bash
MCP_TRANSPORT=http npm start
```

- MCP endpoint: `http://127.0.0.1:3000/mcp`
- Health check: `http://127.0.0.1:3000/health`

With Docker Compose:

```bash
docker compose up --build -d
docker compose ps
curl http://127.0.0.1:3000/health
```

Compose binds the port to loopback on purpose, runs as an unprivileged user, and uses a read-only filesystem. A public endpoint additionally needs TLS and authentication behind a reverse proxy. `ALLOWED_HOSTS` must list every allowed hostname.

## Configuration

| Variable | Default | Description |
|---|---:|---|
| `DB_TIMETABLE_CLIENT_ID` | – | DB client ID, required for API calls |
| `DB_TIMETABLE_CLIENT_SECRET` | – | DB API key, required for API calls |
| `DB_TIMETABLE_BASE_URL` | official v1 URL | Alternative base URL, mainly for tests |
| `DB_TIMETABLE_TIMEOUT_MS` | `15000` | Request timeout between 1000 and 120000 ms |
| `MCP_TRANSPORT` | `stdio` | `stdio` or `http` |
| `HOST` | `127.0.0.1` | HTTP bind address |
| `PORT` | `3000` | HTTP port |
| `MCP_ENDPOINT` | `/mcp` | Streamable HTTP path |
| `ALLOWED_HOSTS` | – | Comma-separated host allowlist, required with `0.0.0.0`/`::` |
| `DOTENV_CONFIG_PATH` | – | Explicit absolute path to an env file |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, or `error` |

The old values `TRANSPORT_TYPE=sse|httpStream` and `SSE_ENDPOINT` still map to Streamable HTTP, so migration does not break an existing client.

## Development

```bash
npm run dev          # stdio with watch mode
npm run dev:http     # Streamable HTTP with watch mode
npm run check        # lint, types, tests, and build
npm run test:coverage
```

Further reading:

- [API reference](docs/api.md)
- [Data model](docs/data-model.md)
- [Architecture](docs/architecture.md)
- [Testing strategy](TESTING.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

The documents under `docs/` are currently written in German.

## Troubleshooting

**`Expected "," or "]" after array element` in Claude Desktop**

Update to version 2 and rebuild. Earlier versions wrote log lines to the stdio protocol channel. Version 2 uses `stderr` for that.

**`DB-API-Zugangsdaten fehlen` even though `.env` exists** (the message reads "DB API credentials are missing")

The file must sit in the repository root next to `package.json`. If it lives somewhere else, set `DOTENV_CONFIG_PATH` to an absolute path. Do not wrap the values in quotes or leave trailing spaces around them.

**401/403 from the DB API**

Check that the client ID and the API key belong together, and that the application has subscribed to the Timetables product.

**Wrong platform**

Use `getStationBoard` and read `effective.platform`. `planned.platform` is the scheduled platform by definition, and `changed.platform` is present only when DB has reported a change.

## Data source and license

The timetable data comes from Deutsche Bahn and is served through the [Timetables API 1.0.274](https://developers.deutschebahn.com/db-api-marketplace/apis/product/timetables/api/160160). According to the DB API Marketplace the data is under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), so attribution to Deutsche Bahn is required when you use it. The Marketplace currently states a limit of 60 calls per minute.

The MCP server itself is under the [MIT license](LICENSE.md).
