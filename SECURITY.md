# Sicherheitsrichtlinie

## Unterstützte Versionen

Sicherheitskorrekturen werden für die aktuelle Hauptversion bereitgestellt.

## Schwachstellen melden

Bitte keine ausnutzbaren Details in einem öffentlichen Issue veröffentlichen. Verwende stattdessen GitHub Private Vulnerability Reporting unter **Security → Report a vulnerability** im Repository. Gib betroffene Version, Auswirkung, Reproduktionsschritte und eine mögliche Abhilfe an.

## Betriebsgrenzen

- Zugangsdaten gehören in Umgebungsvariablen oder eine nicht versionierte `.env`-Datei.
- Streamable HTTP bindet standardmäßig an Loopback. Öffentliche Bereitstellungen benötigen TLS und Authentifizierung vor dem Server.
- Bei `HOST=0.0.0.0` oder `HOST=::` ist `ALLOWED_HOSTS` verpflichtend.
- Der Server ist read-only gegenüber der DB API, kann aber bei ungeschütztem Remote-Zugriff das persönliche API-Kontingent verbrauchen.

## Prüfung

CI führt Lint, Typprüfung, Tests, reproduzierbaren Build, Coverage-Grenzen, `npm audit` und einen Containerbuild aus. Dependabot überwacht npm-, Docker- und GitHub-Actions-Abhängigkeiten.
