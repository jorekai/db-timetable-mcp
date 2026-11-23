# MCP API reference

Every tool is read-only and idempotent. A successful call returns the same envelope:

```json
{
  "source": "Deutsche Bahn OpenBoards API",
  "retrievedAt": "2026-07-17T08:00:00.000Z",
  "endpoint": "/departures",
  "data": {}
}
```

`retrievedAt` is UTC. Times inside `data` carry the unchanged DB value under `raw` and the local time in `Europe/Berlin` under `local`. `findStations` has the source `DB InfraGO OpenStation (NeTEx)` and additionally returns `dataAsOf`, the date of the station index.

## getDepartures, getArrivals, getStationBoard

`getDepartures` and `getArrivals` return one direction. `getStationBoard` queries both in parallel and joins arrival and departure of the same journey at the same stop. It uses two API calls, so prefer the single direction when that is all you need. All three take the same parameters:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `evaNo` | string | required | Exactly seven digits |
| `startTime` | string | now | ISO 8601. Without an offset it is local time in `Europe/Berlin`. The DB documents up to 30 days in the past |
| `durationMinutes` | integer | `60` | Length of the time window, 1 to 480 |
| `platforms` | string[] | all | Only these platforms |
| `transportTypes` | string[] | all | `HIGH_SPEED_TRAIN`, `INTERCITY_TRAIN`, `INTER_REGIONAL_TRAIN`, `REGIONAL_TRAIN`, `CITY_TRAIN` |
| `includeNearbyStops` | boolean | `true` | Include stops that belong together, such as an underground station. With `false` only the given EVA number |
| `maxEntriesPerTransportType` | integer | `50` | 1 to 50 |

```json
{
  "evaNo": "8000105",
  "startTime": "2026-07-17T10:00",
  "durationMinutes": 120,
  "transportTypes": ["HIGH_SPEED_TRAIN", "INTERCITY_TRAIN"]
}
```

`data` contains:

| Field | Meaning |
|---|---|
| `station` | Requested EVA number and, if known, its name |
| `window` | Start and end of the queried time window |
| `consideredStopPlaces` | Stops that DB included in the board |
| `truncatedTransportTypes` | Not empty when entries were cut off. Shorten the window or restrict `transportTypes` |
| `stops` | Train stops, see [data-model.md](data-model.md) |

In `getStationBoard`, a missing `arrival` or `departure` means that the journey starts or ends here, or that the event lies outside the time window. If one of the two API calls fails, the whole tool call fails instead of returning half a board.

## findStations

Searches the bundled station index. It needs no credentials and makes no network call.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `pattern` | string | required | 1 to 100 characters: name, EVA number, or DS100 code |
| `limit` | integer | `20` | 1 to 100 |

Upper and lower case, umlauts, and abbreviations such as `Hbf` do not matter. Exact matches come first, then larger stations. The response contains `totalMatches` and `stations` with `evaNo`, `evaNumbers`, `ds100Codes`, `stada`, `name`, `otherNames`, and `platforms`. `evaNo` is the EVA number to use for a board.

## Resources

| URI | MIME type | Content |
|---|---|---|
| `db-timetable://docs/data-model` | `application/json` | Semantics of the normalized fields |
| `db-api:board/{evaNo}` | `application/json` | Arrivals and departures of the next 60 minutes |
| `db-api:departures/{evaNo}` | `application/json` | Departures of the next 60 minutes |
| `db-api:arrivals/{evaNo}` | `application/json` | Arrivals of the next 60 minutes |
| `db-api:station/{pattern}` | `application/json` | Station search, pattern percent-encoded |

## Errors

Tool errors are returned MCP-conformantly with `isError: true` and a stable structure:

```json
{
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Die DB OpenBoards API hat die Zugangsdaten abgelehnt. [...]"
  }
}
```

The domain codes are `AUTHENTICATION_ERROR`, `RESOURCE_NOT_FOUND`, `INVALID_INPUT`, `API_TIMEOUT`, `API_RATE_LIMIT`, `API_UNAVAILABLE`, `API_INVALID_RESPONSE`, and `API_ERROR`. The MCP schema rejects invalid input before the API call is made.
