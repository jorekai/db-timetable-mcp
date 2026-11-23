# Contributing

## Development environment

```bash
git clone https://github.com/jorekai/db-timetable-mcp.git
cd db-timetable-mcp
npm ci
npm run check
```

CI checks Node.js 22, 24, and 26 LTS.

## Git hooks

`npm ci` installs the hooks from `lefthook.yml`.

| Hook | Checks |
|---|---|
| `pre-commit` | oxlint and oxfmt on staged files, with automatic fixes, and gitleaks |
| `pre-push` | No direct push to `master`, type check, lint including `lint:changed`, and gitleaks on outgoing commits |

The secret scan needs a local [gitleaks](https://github.com/gitleaks/gitleaks) and is skipped with a note without it. CI runs it in any case. `--no-verify` skips the hooks for one command, and `LEFTHOOK=0` turns them off. If you use your own `core.hooksPath`, run `npx lefthook install` after deciding which one should win.

## Changes

1. For a bug, add a reproducing test first.
2. Treat public tool and resource descriptions as part of the API contract.
3. Never commit DB credentials or live responses containing personal data.
4. Run `npm run check`, `npm run lint:changed`, and `npm run test:coverage` before a pull request.
5. Update the documentation and `CHANGELOG.md` for visible changes.

Commits should be small, traceable, and phrased as a human-readable action, for example `Fix stdio logging corrupting MCP messages`.
