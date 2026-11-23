# Architecture

```mermaid
flowchart LR
    Client["MCP client"] -->|"stdio or Streamable HTTP"| Server["Official MCP SDK"]
    Server --> Tools["Tools and resources"]
    Tools --> API["DB API client"]
    API -->|"JSON over HTTPS"| DB["DB OpenBoards API"]
    API --> Mapper["Mapping and arrival/departure merge"]
    API --> Search["Local station search"]
    Export["OpenStation NeTEx export"] -.->|"npm run stations:update"| Search
    Mapper -->|"structuredContent + JSON"| Server
    Search -->|"structuredContent + JSON"| Server
```

## Components

- `src/server.ts` creates an independent MCP server instance and registers capabilities.
- `src/transport.ts` separates stdio from stateless Streamable HTTP.
- `src/api/timetableApi.ts` encapsulates authentication, timeouts, HTTP errors, and endpoints.
- `src/api/openBoards.ts` describes the raw responses; `src/api/boardMapper.ts` translates them into the public model.
- `src/stations/` holds the generated station index and the search over it.
- `src/utils/berlinTime.ts` converts between UTC and local time in `Europe/Berlin`.
- `scripts/` builds the station index. It is a development tool and not part of the package.
- `src/tools/` and `src/resources/` define MCP schemas, descriptions, and results.

## Transport decisions

stdio is the default for local processes started by the client. The logger writes to `stderr` only, so every line on `stdout` stays a valid MCP message.

For remote operation the server uses the current Streamable HTTP transport. It is stateless because the timetable tools need no server-side sessions. That simplifies horizontal scaling and avoids growing in-memory state. Legacy HTTP+SSE is not offered again; old configuration values are migrated to Streamable HTTP.

## Station index

OpenBoards has no station search. The server therefore ships a generated index of about 5,700 stations (230 KB) instead of calling a second API. This keeps the search free of credentials, quota, and latency, and it works in edge runtimes without file access. The price is that the index ages; `dataAsOf` states its date. The export itself is about 309 MB uncompressed and is read as a stream.

```bash
npm run stations:update                 # download the current export
npm run stations:update -- export.xml   # use a local file
```

The script aborts without writing when the export is cut off, has no publication date, or yields fewer than 5,000 stations.

## Security

- Credentials are read from environment variables or `.env` only and are never logged.
- Request paths are fixed. Input reaches DB only in the JSON body.
- Zod constrains tool input; API calls have a configurable timeout.
- HTTP binds to `127.0.0.1` by default. Wildcard bindings require `ALLOWED_HOSTS` against DNS rebinding.
- The container runs as `node`, holds no Linux capabilities in the Compose profile, and uses a read-only root filesystem.
- A publicly reachable transport belongs behind an authenticating TLS reverse proxy. The server itself stores no user identities.

## Operations and rollback

The health check verifies process and MCP readiness only and consumes no DB API quota. Releases should be tagged with an immutable image version. A rollback goes to the previous Git tag or the previous container tag; no data migrations are required.
