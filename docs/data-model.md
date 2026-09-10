# Semantic data model

The DB Timetables API uses compact XML attributes such as `pt`, `ct`, `pp`, and `cp`. They are efficient for machines and ambiguous for language models. The server translates them without losing meaning.

## Event values

| JSON field | DB field | Meaning |
|---|---|---|
| `planned.time` | `pt` | scheduled time |
| `changed.time` | `ct` | changed or expected time |
| `planned.platform` | `pp` | scheduled platform |
| `changed.platform` | `cp` | changed platform |
| `planned.path` | `ppth` | planned route |
| `changed.path` | `cpth` | changed route |
| `planned.status` | `ps` | scheduled status |
| `changed.status` | `cs` | changed status, in particular a cancellation |

`effective` is assembled field by field: a present change value wins, otherwise the scheduled value stands. A change to the time alone therefore does not discard the scheduled platform that is still known.

The server additionally computes:

- `delayMinutes`: the difference between `changed.time` and `planned.time`.
- `platformChanged`: whether `cp` and `pp` differ.
- `isCancelled`: whether the effective status is `cancelled`.

## Timestamps

DB timestamps use the format `YYMMDDHHmm`, for example `2607171027`. The server returns:

```json
{
  "raw": "2607171027",
  "local": "2026-07-17T10:27",
  "timezone": "Europe/Berlin"
}
```

No UTC offset is invented. The IANA timezone makes daylight saving explicit, and `raw` allows a lossless check against the source.

## Merging a station board

`getStationBoard` loads `/plan` and `/fchg` in parallel. Stops are joined on the unique stop ID. Scheduled data provides the base state, and changes only add fields that were actually reported. Unplanned stops that were added remain in the result.

## Message types

Codes are translated to `him`, `quality_change`, `free_text`, `cause_of_delay`, `ibis`, `disruption`, and `connection`, among others. Unknown future codes stay recognizable as `unknown` instead of failing the whole API call.

The authoritative field description is the [official Timetables OpenAPI specification](https://developers.deutschebahn.com/db-api-marketplace/apis/product/timetables/api/160160).
