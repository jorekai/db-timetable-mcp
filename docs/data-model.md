# Semantisches Datenmodell

Die DB Timetables API verwendet kompakte XML-Attribute wie `pt`, `ct`, `pp` und `cp`. Diese sind für Maschinen effizient, für Sprachmodelle aber mehrdeutig. Der Server übersetzt sie ohne Bedeutungsverlust.

## Ereigniswerte

| JSON-Feld | DB-Feld | Bedeutung |
|---|---|---|
| `planned.time` | `pt` | Sollzeit |
| `changed.time` | `ct` | geänderte/erwartete Zeit |
| `planned.platform` | `pp` | Sollgleis |
| `changed.platform` | `cp` | geändertes Gleis |
| `planned.path` | `ppth` | geplanter Fahrtweg |
| `changed.path` | `cpth` | geänderter Fahrtweg |
| `planned.status` | `ps` | geplanter Status |
| `changed.status` | `cs` | geänderter Status, insbesondere Ausfall |

`effective` wird feldweise zusammengesetzt: Ein vorhandener Änderungswert gewinnt, andernfalls bleibt der Sollwert bestehen. So führt eine reine Zeitänderung nicht dazu, dass das bekannte Sollgleis verloren geht.

Zusätzlich berechnet der Server:

- `delayMinutes`: Differenz zwischen `changed.time` und `planned.time`.
- `platformChanged`: ob `cp` und `pp` verschieden sind.
- `isCancelled`: ob der wirksame Status `cancelled` ist.

## Zeitstempel

DB-Zeitstempel haben das Format `YYMMDDHHmm`, beispielsweise `2607171027`. Der Server liefert:

```json
{
  "raw": "2607171027",
  "local": "2026-07-17T10:27",
  "timezone": "Europe/Berlin"
}
```

Es wird bewusst kein UTC-Offset erfunden. Die IANA-Zeitzone macht Sommer- und Winterzeit explizit, während `raw` eine verlustfreie Prüfung gegen die Quelle erlaubt.

## Zusammenführen einer Bahnhofstafel

`getStationBoard` lädt `/plan` und `/fchg` parallel. Stops werden über die eindeutige Stop-ID verbunden. Solldaten stellen den Grundzustand, Änderungen ergänzen nur tatsächlich gemeldete Felder. Ungeplante, neu hinzugefügte Stops bleiben erhalten.

## Meldungstypen

Codes werden unter anderem zu `him`, `quality_change`, `free_text`, `cause_of_delay`, `ibis`, `disruption` und `connection` übersetzt. Unbekannte zukünftige Codes bleiben als `unknown` erkennbar, statt den gesamten API-Aufruf scheitern zu lassen.

Die maßgebliche Feldbeschreibung ist die [offizielle Timetables-OpenAPI-Spezifikation](https://developers.deutschebahn.com/db-api-marketplace/apis/product/timetables/api/160160).
