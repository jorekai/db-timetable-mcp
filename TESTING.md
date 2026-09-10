# Testing strategy

The test pyramid consists of fast parser and configuration tests, MCP contract tests over in-memory transports, and a real Streamable HTTP client against a temporary local server. External DB calls do not run in automated tests.

## Full check

```bash
npm ci
npm run check
npm run test:coverage
npm audit --audit-level=high
```

`npm run check` runs Biome, TypeScript, all Vitest suites, and the production build. The coverage thresholds are 85% for lines, functions, and statements, and 80% for branches.

## Test areas

| Suite | Coverage |
|---|---|
| `timetableParser.test.ts` | XML validation, semantic fields, timestamps, platforms, messages, and the merge logic |
| `api.test.ts` | Auth headers, URL encoding, error mapping, the raw XML option, and the station board |
| `server.test.ts` | MCP tool schemas, structured output, input validation, and resources |
| `transport.test.ts` | Health check, stateless Streamable HTTP, and rejection of the old SSE GET flow |
| `stdio.e2e.test.ts` | A real MCP handshake with a started stdio subprocess and stderr logging |
| `config.test.ts` | `.env` resolution, safe network defaults, and legacy migration |
| `utils/*` | Error classes and stderr-only logging |

## Manual MCP test

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/index.js
```

In the inspector, call `findStations` with `Frankfurt` first, then `getStationBoard` with the EVA number you found.

## Streamable HTTP

```bash
MCP_TRANSPORT=http npm start
curl http://127.0.0.1:3000/health
```

The full MCP contract is already tested automatically with the official TypeScript client. For network diagnosis you can connect the inspector to `http://127.0.0.1:3000/mcp`.

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

## Live smoke test

A live test consumes your personal API quota and therefore does not run in CI on purpose. With a valid `.env` you can check `getStationBoard` for EVA `8000105`, the current date in `YYMMDD` format, and an hour `HH` through the inspector.
