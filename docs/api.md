# MCP API-Referenz

Alle Tools sind read-only und idempotent. Erfolgreiche Aufrufe liefern denselben Umschlag:

```json
{
  "source": "Deutsche Bahn Timetables API",
  "retrievedAt": "2026-07-17T08:00:00.000Z",
  "endpoint": "/plan/8000105/260717/10",
  "data": {},
  "rawXml": "optional"
}
```

`retrievedAt` ist UTC. DB-Fahrplanzeiten bleiben als lokale Zeit in `Europe/Berlin` erhalten und enthalten zusätzlich den unveränderten DB-Wert unter `raw`.

## getStationBoard

Die bevorzugte Schnittstelle für Ankünfte und Abfahrten. Der Server ruft den Sollfahrplan der Stunde und den vollständigen Änderungsbestand parallel ab und verbindet Stops über ihre DB-Stop-ID.

| Parameter | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `evaNo` | string | ja | Genau sieben Ziffern |
| `date` | string | ja | Betriebstag `YYMMDD` |
| `hour` | string | ja | Stunde `00` bis `23` |
| `includeRawXml` | boolean | nein | Soll- und Änderungs-XML zusätzlich beifügen |

```json
{
  "evaNo": "8000105",
  "date": "260717",
  "hour": "10"
}
```

## getPlannedTimetable

Liefert ausschließlich den statischen Sollfahrplan aus `/plan/{evaNo}/{date}/{hour}`. Die Zeitfenster überlappen laut DB geringfügig; bei mehreren Stunden sollten Stops anhand ihrer `id` dedupliziert werden.

Parameter: `evaNo`, `date`, `hour`, optional `includeRawXml`.

## getCurrentTimetable

Liefert den vollständigen bekannten Änderungsbestand aus `/fchg/{evaNo}`. Der historische Toolname bleibt aus Kompatibilitätsgründen erhalten. Ohne Sollfahrplan können nicht geänderte Felder fehlen; für eine fertige Bahnhofstafel daher `getStationBoard` verwenden.

Parameter: `evaNo`, optional `includeRawXml`.

## getRecentChanges

Liefert das Delta aus `/rchg/{evaNo}`. Die DB beschreibt dieses als Änderungen, die innerhalb der letzten zwei Minuten bekannt wurden. Ein Client sollte zunächst vollständige Daten laden und danach höchstens im zulässigen API-Kontingent pollen.

Parameter: `evaNo`, optional `includeRawXml`.

## findStations

Sucht über `/station/{pattern}` nach Name, EVA-Nummer oder DS100-Code.

| Parameter | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `pattern` | string | ja | 1 bis 100 Zeichen; wird sicher als URL-Segment kodiert |
| `includeRawXml` | boolean | nein | DB-XML zusätzlich beifügen |

Die Antwort enthält `evaNo`, `ds100`, `name`, `platforms` und `metaStations`.

## Ressourcen

| URI | MIME-Type | Inhalt |
|---|---|---|
| `db-timetable://docs/data-model` | `application/json` | Semantik der normalisierten Felder |
| `db-api:timetable/current/{evaNo}` | `application/json` | Vollständige Änderungen |
| `db-api:timetable/changes/{evaNo}` | `application/json` | Jüngste Änderungen |
| `db-api:timetable/planned/{evaNo}/{date}/{hour}` | `application/json` | Sollfahrplan |
| `db-api:station/{pattern}` | `application/json` | Stationssuche |

## Fehler

Toolfehler werden MCP-konform mit `isError: true` und einer stabilen Struktur geliefert:

```json
{
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Die DB Timetables API hat die Zugangsdaten abgelehnt."
  }
}
```

Mögliche fachliche Codes: `AUTHENTICATION_ERROR`, `RESOURCE_NOT_FOUND`, `API_TIMEOUT`, `API_RATE_LIMIT`, `API_UNAVAILABLE` und `API_ERROR`. Ungültige Eingaben weist das MCP-Schema bereits vor dem API-Aufruf zurück.
