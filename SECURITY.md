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

## Checks

CI runs lint, type checking, tests, a reproducible build, coverage thresholds, `npm audit`, and a container build. Dependabot tracks npm, Docker, and GitHub Actions dependencies.
