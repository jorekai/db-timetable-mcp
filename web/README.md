# DB Timetables MCP — Vercel web app

A real MCP client in the browser, plus a plain-language explainer of what MCP,
the timetable time fields, and the worker cache actually do.

The browser talks **directly** to the Cloudflare Worker over Streamable HTTP.
There is no REST wrapper, no Next.js route as a proxy, and no server action.
Every JSON-RPC message is shown verbatim in the protocol panel.

Built with Next.js (App Router), shadcn/ui, and Tailwind CSS.

## Routes

- `/en` and `/de` are the two locales. `/` redirects to the preferred language
  based on `Accept-Language`.

## Configuration

`lib/config.ts` holds the worker endpoint and the protocol version. The endpoint
is public, not a secret. The DB API credentials live only as a Worker secret and
never reach the browser.

For local development the endpoint can be overridden per page load:

```
http://localhost:3000/en?endpoint=http://localhost:8791/mcp
```

`?simulate=500` forwards the `X-Simulate-Upstream-Error` header. The worker only
honors it when `ALLOW_SIMULATION=1`, which is local only. In production the header
is inert.

## Local development

The worker must allow this origin. `worker/.dev.vars.example` already lists
`http://localhost:8000`; run this app on port 8000 to match, or add your own
origin to `worker/.dev.vars` (never to the production allowlist).

```bash
# terminal 1 — worker on http://localhost:8791
npm run dev:worker

# terminal 2 — web on http://localhost:8000
npm --prefix web run dev -- -p 8000
```

Then open `http://localhost:8000/en?endpoint=http://localhost:8791/mcp`.

## Deploy

The app is deployed on Vercel. The origin of the deployment must be in the
worker's `ALLOWED_ORIGINS` (exact match, never `*`):

```bash
# add https://<project>.vercel.app to worker/wrangler.toml, then
npm run deploy:worker
```

## Privacy

No cookies, no analytics, no third-party requests. All assets are served from
this origin.
