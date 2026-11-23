# Semantic data model

OpenBoards splits a board into separate lists for departures and arrivals and moves names, operators, and messages into lookup tables. The server resolves these references and returns one flat object per train stop.

## Train stop

| Field | Meaning |
|---|---|
| `journeyId` | DB identifier of the journey |
| `evaNo`, `stationName` | The concrete stop. It can differ from the requested EVA number when nearby stops are included |
| `trip` | Category, number, line, operator, origin, destination, direction, replacement transport, cancellation |
| `arrival`, `departure` | Events, see below |

## Event values

| JSON field | OpenBoards field | Meaning |
|---|---|---|
| `planned.time` | `timeSchedule` | scheduled time |
| `planned.platform` | `platformSchedule` | scheduled platform |
| `effective.time` | `time` | time to display |
| `effective.platform` | `platform`, otherwise `platformSchedule` | platform to display |
| `timeType` | `timeType` | `SCHEDULE` without live data, `PREVIEW` forecast, `REAL` already happened |
| `isCancelled` | `cancelled` | the arrival or departure is cancelled |
| `isAdditional` | `additional` | additional stop; together with `isCancelled` a withdrawn additional stop |
| `via` | `transport.via` | selection of stops along the way, never complete |

The server additionally computes:

- `delayMinutes`: the difference between `effective.time` and `planned.time`, rounded to whole minutes. Early trains are negative.
- `platformChanged`: whether both platforms are known and differ.

## Timestamps

```json
{
  "raw": "2026-07-17T10:27:00+02:00",
  "local": "2026-07-17T10:27",
  "timezone": "Europe/Berlin"
}
```

Input without an offset is read as local time in `Europe/Berlin`. A time that exists twice when the clocks go back means the earlier one. A time that is skipped when the clocks go forward moves ahead by one hour.

## Merging a station board

`getStationBoard` loads `/arrivals` and `/departures` in parallel. Arrival and departure belong together when `journeyId` and the EVA number match. If a journey calls at the same stop more than once, as ring lines do, each departure gets the last arrival before it.

## Message types

Messages have the type `disruption`, `cause`, `quality`, `note`, or `attribute`. References to messages that the response does not contain are left out.
