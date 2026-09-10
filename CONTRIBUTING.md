# Contributing

## Development environment

```bash
git clone https://github.com/jorekai/db-timetable-mcp.git
cd db-timetable-mcp
npm ci
npm run check
```

CI checks Node.js 22 and 24 LTS.

## Changes

1. For a bug, add a reproducing test first.
2. Treat public tool and resource descriptions as part of the API contract.
3. Never commit DB credentials or live responses containing personal data.
4. Run `npm run check` and `npm run test:coverage` before a pull request.
5. Update the documentation and `CHANGELOG.md` for visible changes.

Commits should be small, traceable, and phrased as a human-readable action, for example `Fix stdio logging corrupting MCP messages`.
