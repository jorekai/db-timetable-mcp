# MCP API reference

Every tool is read-only and idempotent. A successful call returns the same envelope:

```json
{
  "source": "Deutsche Bahn Timetables API",
  "retrievedAt": "2026-07-17T08:00:00.000Z",
  "endpoint": "/plan/8000105/260717/10",
  "data": {},
  "rawXml": "optional"
}
```

`retrievedAt` is UTC. DB timetable times stay in local time in `Europe/Berlin` and additionally carry the unchanged DB value under `raw`.

## getStationBoard

The preferred interface for arrivals and departures. The server fetches the planned timetable for the hour and the full change set in parallel, then joins the stops on their DB stop ID.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `evaNo` | string | yes | Exactly seven digits |
| `date` | string | yes | Operating day `YYMMDD` |
| `hour` | string | yes | Hour `00` to `23` |
| `includeRawXml` | boolean | no | Also attach the planned and change XML |

```json
{
  "evaNo": "8000105",
  "date": "260717",
  "hour": "10"
}
```

## getPlannedTimetable

Returns the static planned timetable from `/plan/{evaNo}/{date}/{hour}` and nothing else. According to DB the time windows overlap slightly, so across several hours you should deduplicate stops on their `id`.

Parameters: `evaNo`, `date`, `hour`, optional `includeRawXml`.

## getCurrentTimetable

Returns the full known change set from `/fchg/{evaNo}`. The historical tool name is kept for compatibility. Without the planned timetable, unchanged fields can be missing, so use `getStationBoard` when you need a finished station board.

Parameters: `evaNo`, optional `includeRawXml`.

## getRecentChanges

Returns the delta from `/rchg/{evaNo}`. DB describes this as changes that became known within the last two minutes. A client should load the full data first and then poll no faster than the API quota allows.

Parameters: `evaNo`, optional `includeRawXml`.

## findStations

Searches `/station/{pattern}` by name, EVA number, or DS100 code.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `pattern` | string | yes | 1 to 100 characters, encoded safely as a URL segment |
| `includeRawXml` | boolean | no | Also attach the DB XML |

The response contains `evaNo`, `ds100`, `name`, `platforms`, and `metaStations`.

## Resources

| URI | MIME type | Content |
|---|---|---|
| `db-timetable://docs/data-model` | `application/json` | Semantics of the normalized fields |
| `db-api:timetable/current/{evaNo}` | `application/json` | Full changes |
| `db-api:timetable/changes/{evaNo}` | `application/json` | Recent changes |
| `db-api:timetable/planned/{evaNo}/{date}/{hour}` | `application/json` | Planned timetable |
| `db-api:station/{pattern}` | `application/json` | Station search |

## Errors

Tool errors are returned MCP-conformantly with `isError: true` and a stable structure:

```json
{
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Die DB Timetables API hat die Zugangsdaten abgelehnt."
  }
}
```

The domain codes are `AUTHENTICATION_ERROR`, `RESOURCE_NOT_FOUND`, `API_TIMEOUT`, `API_RATE_LIMIT`, `API_UNAVAILABLE`, and `API_ERROR`. The MCP schema rejects invalid input before the API call is made.
