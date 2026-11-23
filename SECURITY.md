# Security policy

## Supported versions

Security fixes are provided for the current major version.

## Reporting a vulnerability

Please do not publish exploitable details in a public issue. Use GitHub Private Vulnerability Reporting under **Security → Report a vulnerability** in the repository instead. Include the affected version, the impact, reproduction steps, and a possible mitigation.

## Operating limits

- Credentials belong in environment variables or an unversioned `.env` file.
- Streamable HTTP binds to loopback by default. Public deployments need TLS and authentication in front of the server.
- With `HOST=0.0.0.0` or `HOST=::`, `ALLOWED_HOSTS` is required.
- The server is read-only against the DB API, but unprotected remote access can consume your personal API quota.
- `tools/call` arguments are limited to 1,000 array elements and object keys.

## Checks

CI runs oxlint and oxfmt, type checking, tests with coverage thresholds, a reproducible build, and a container build. These security checks run as well:

| Check | Scope | Blocks |
|---|---|---|
| `npm audit` | Runtime dependencies from `moderate`, all dependencies from `high` | Yes |
| Semgrep | `p/typescript` and `p/nodejs` | `ERROR` rules only |
| gitleaks | Commits of a pull request, otherwise the full history | Yes |
| zizmor | GitHub Actions workflows and the Dependabot configuration | From medium severity |

The audit, Semgrep, and the full secret scan also run every week. Actions are pinned to commit hashes. Dependabot tracks npm, Docker, and GitHub Actions dependencies and waits seven days before it proposes a new release; security updates are not delayed.
