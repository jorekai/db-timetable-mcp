# Beitragen

## Entwicklungsumgebung

```bash
git clone https://github.com/jorekai/db-timetable-mcp.git
cd db-timetable-mcp
npm ci
npm run check
```

Node.js 22 und 24 LTS werden in CI geprüft.

## Änderungen

1. Für Fehler zuerst einen reproduzierenden Test hinzufügen.
2. Öffentliche Tool- und Ressourcenbeschreibungen als Teil des API-Vertrags behandeln.
3. Keine DB-Zugangsdaten oder Live-Antworten mit personenbezogenen Inhalten committen.
4. `npm run check` und `npm run test:coverage` vor einem Pull Request ausführen.
5. Dokumentation und `CHANGELOG.md` bei sichtbaren Änderungen aktualisieren.

Commits sollten klein, nachvollziehbar und als menschlich lesbare Handlung formuliert sein, beispielsweise `Fix stdio logging corrupting MCP messages`.
