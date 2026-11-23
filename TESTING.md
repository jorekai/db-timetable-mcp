# Testing strategy

The test pyramid consists of fast mapping, search, time, and configuration tests, MCP contract tests over in-memory transports, and a real Streamable HTTP client against a temporary local server. External DB calls do not run in automated tests.

## Full check

```bash
npm ci
npm run check
npm run test:coverage
npm audit --audit-level=high
```

`npm run check` runs oxlint, oxfmt, TypeScript, all Vitest suites, and the production build. The coverage thresholds are 85% for lines, functions, and statements, and 80% for branches.

## Lint and formatting

- `npm run lint` checks the whole repository, `npm run lint:fix` fixes and formats.
- `npm run lint:changed` applies the stricter anti-slop rules from `.oxlintrc.changed.json` to the files your branch changes compared with `master`. Existing code still has findings in this tier, so a file you touch has to meet it. A branch that changes the lint setup itself skips this tier.
- `npm run knip` lists unused files, exports, and dependencies. It is a report and does not block CI.

## Test areas

| Suite | Coverage |
|---|---|
| `boardMapper.test.ts` | Semantic fields, platforms, messages, and the merge logic including ring lines |
| `berlinTime.test.ts` | Local time, clock changes, and invalid input |
| `stationSearch.test.ts` | Integrity of the bundled index, normalization, and ranking |
| `stationIndex.test.ts` | Index generator with both NeTEx name forms, streaming, and truncated exports |
| `api.test.ts` | Auth headers, request bodies, error mapping, invalid responses, and the station board |
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

A live test consumes your personal API quota and therefore does not run in CI on purpose. With a valid `.env` you can check `getDepartures` and `getStationBoard` for EVA `8000105` through the inspector. The fixtures in `src/tests/fixtures.ts` follow the OpenBoards 1.0.3 specification and are not recorded responses.
