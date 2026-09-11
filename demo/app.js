/*
 * Browser MCP client for the DB Timetables MCP worker.
 *
 * Speaks raw JSON-RPC 2.0 over the MCP Streamable HTTP transport. There is no
 * REST wrapper: every request below is a protocol message, and every message is
 * shown verbatim in the protocol panel.
 *
 * No build step, no framework, no dependencies, no cookies, no tracking.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Deployed worker endpoint, e.g. "https://db-timetable-mcp.<subdomain>.workers.dev/mcp".
 * Override per request with ?endpoint=https://…/mcp (handy for local development).
 */
const DEFAULT_ENDPOINT =
	"https://db-timetable-mcp.nils-jorek6753.workers.dev/mcp";

/** The negotiated protocol version we request on initialize. */
const PROTOCOL_VERSION = "2025-06-18";

const CLIENT_INFO = { name: "db-timetable-mcp-browser-demo", version: "1.0.0" };

/** How many upcoming departures to show. */
const BOARD_SIZE = 20;

/** Trains that left this long ago stay visible. */
const GRACE_MS = 2 * 60 * 1000;

const ENDPOINT =
	new URLSearchParams(location.search).get("endpoint") || DEFAULT_ENDPOINT;

/** True while no worker endpoint is configured. */
const NOT_CONFIGURED = ENDPOINT.length === 0;
const CONFIGURATION_HINT =
	"No worker endpoint configured. Set DEFAULT_ENDPOINT in demo/app.js to your deployed worker, or open this page with ?endpoint=https://…/mcp";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);

/** The API time format YYMMDDHHMM is local time in Europe/Berlin. */
function berlinParts(date) {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Europe/Berlin",
		year: "2-digit",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(date);

	const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";
	return {
		yy: get("year"),
		mm: get("month"),
		dd: get("day"),
		hh: get("hour") === "24" ? "00" : get("hour"),
		mi: get("minute"),
	};
}

/** YYMMDDHHMM of a stamp in the same pseudo-UTC basis as the API. */
function stampToMillis(stamp) {
	if (typeof stamp !== "string" || !/^\d{10}$/.test(stamp)) return null;
	return Date.UTC(
		2000 + Number(stamp.slice(0, 2)),
		Number(stamp.slice(2, 4)) - 1,
		Number(stamp.slice(4, 6)),
		Number(stamp.slice(6, 8)),
		Number(stamp.slice(8, 10)),
	);
}

function hhmm(stamp) {
	if (typeof stamp !== "string" || stamp.length < 10) return null;
	return `${stamp.slice(6, 8)}:${stamp.slice(8, 10)}`;
}

/**
 * The worker merges the planned timetable with the realtime changes and
 * returns one document per stop. `effective` is the value to display;
 * `planned` and `changed` only explain the deviation.
 */
function stopToDeparture(stop) {
	const event = stop.departure ?? stop.arrival;
	if (!event) return null;

	const planned = event.planned?.time?.raw ?? null;
	const changed = event.changed?.time?.raw ?? null;
	const effective = event.effective?.time?.raw ?? planned ?? changed;

	const plannedPlatform = event.planned?.platform ?? null;
	const effectivePlatform =
		event.effective?.platform ?? plannedPlatform ?? null;

	const path = event.effective?.path ?? event.planned?.path ?? [];
	const destination =
		event.effective?.distantEndpoint ??
		event.planned?.distantEndpoint ??
		(path.length > 0 ? path[path.length - 1] : null);

	const trip = stop.trip ?? {};
	const label = [trip.category, trip.number].filter(Boolean).join(" ") || null;

	return {
		stopId: stop.id,
		label,
		destination,
		plannedHhmm: hhmm(planned),
		changedHhmm: hhmm(changed),
		effectiveHhmm: hhmm(effective),
		plannedPlatform,
		effectivePlatform,
		platformChanged: Boolean(event.platformChanged),
		delayMinutes: event.delayMinutes ?? null,
		cancelled: Boolean(event.isCancelled),
		hasRealtime: Boolean(event.changed),
		messages: [...(event.messages ?? []), ...(stop.messages ?? [])],
		sortKey: stampToMillis(effective),
	};
}

/** Upcoming departures from a merged station board, already sorted. */
function buildDepartures(stops) {
	const now = berlinParts(new Date());
	const nowMs =
		stampToMillis(`${now.yy}${now.mm}${now.dd}${now.hh}${now.mi}`) ?? 0;

	const departures = [];
	for (const stop of stops) {
		if (!stop.departure) continue;
		const departure = stopToDeparture(stop);
		if (!departure) continue;
		if (departure.sortKey !== null && departure.sortKey >= nowMs - GRACE_MS) {
			departures.push(departure);
		}
	}

	departures.sort((a, b) => a.sortKey - b.sortKey);
	return departures.slice(0, BOARD_SIZE);
}

function ageSeconds(isoString) {
	if (!isoString) return null;
	return Math.max(0, Math.round((Date.now() - Date.parse(isoString)) / 1000));
}

// ---------------------------------------------------------------------------
// Protocol log
// ---------------------------------------------------------------------------

const protocolEntries = [];
let protocolRendered = 0;

function record(direction, method, payload, note) {
	protocolEntries.push({ direction, method, note, payload });
	$("protocol-count").textContent = `${protocolEntries.length} message${
		protocolEntries.length === 1 ? "" : "s"
	} recorded`;
	if (!$("protocol").hidden) renderProtocol();
}

function renderProtocol() {
	const container = $("protocol");

	for (let i = protocolRendered; i < protocolEntries.length; i += 1) {
		const entry = protocolEntries[i];
		const details = document.createElement("details");
		details.className = `msg ${entry.direction}`;
		if (entry.direction === "in") details.open = false;

		const summary = document.createElement("summary");

		const dir = document.createElement("span");
		dir.className = "dir";
		dir.textContent = entry.direction === "out" ? "→ sent" : "← received";
		summary.append(dir);

		const method = document.createElement("span");
		method.className = "rpc-method";
		method.textContent = entry.method;
		summary.append(method);

		if (entry.note) {
			const note = document.createElement("span");
			note.className = "rpc-note";
			note.textContent = entry.note;
			summary.append(note);
		}

		const pre = document.createElement("pre");
		const code = document.createElement("code");
		code.textContent = JSON.stringify(entry.payload, null, 2);
		pre.append(code);

		details.append(summary, pre);
		container.append(details);
	}

	protocolRendered = protocolEntries.length;
}

// ---------------------------------------------------------------------------
// MCP client
// ---------------------------------------------------------------------------

const session = {
	initialized: false,
	protocolVersion: PROTOCOL_VERSION,
	tools: [],
	serverInfo: null,
};

let nextId = 1;

/**
 * Cache state of the most recent response. The worker reports it additively via
 * X-MCP-* headers, so the tool contract itself stays untouched.
 */
let lastMeta = {
	fromCache: null,
	stale: false,
	upstreamCalls: 0,
	retrievedAt: null,
};

class ThrottledError extends Error {
	constructor(message, retryAfterSeconds) {
		super(message);
		this.name = "ThrottledError";
		this.retryAfterSeconds = retryAfterSeconds;
	}
}

class ProtocolError extends Error {
	constructor(code, message) {
		super(message);
		this.name = "ProtocolError";
		this.code = code;
	}
}

/** Streamable HTTP may answer with JSON or with an SSE stream. Accept both. */
function parseBody(text, contentType) {
	if (!text) return null;
	if (contentType.includes("text/event-stream")) {
		let last = null;
		for (const line of text.split("\n")) {
			if (!line.startsWith("data:")) continue;
			const data = line.slice(5).trim();
			if (!data) continue;
			try {
				last = JSON.parse(data);
			} catch {
				/* ignore non-JSON keepalive frames */
			}
		}
		return last;
	}
	return JSON.parse(text);
}

async function post(body, note) {
	const method = body.method ?? "-";
	record("out", method, body, note);

	const response = await fetch(ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json, text/event-stream",
			"MCP-Protocol-Version": session.protocolVersion,
		},
		body: JSON.stringify(body),
	});

	const text = await response.text();
	const contentType = response.headers.get("content-type") ?? "";

	const cacheState = response.headers.get("x-mcp-cache");
	lastMeta = {
		fromCache: cacheState === null ? null : cacheState === "hit",
		stale: response.headers.get("x-mcp-cache-stale") === "true",
		upstreamCalls: Number(response.headers.get("x-mcp-upstream-calls") ?? "0"),
		retrievedAt: response.headers.get("x-mcp-retrieved-at"),
	};

	if (response.status === 429) {
		const retryAfter = Number(response.headers.get("retry-after") ?? "60");
		record(
			"in",
			method,
			{ httpStatus: 429, retryAfterSeconds: retryAfter },
			"rate limited",
		);
		throw new ThrottledError("Rate limited", retryAfter);
	}

	if (!response.ok) {
		let parsed = null;
		try {
			parsed = parseBody(text, contentType);
		} catch {
			/* keep parsed null */
		}
		const code = parsed?.error?.code ?? `HTTP_${response.status}`;
		const message =
			parsed?.error?.message ?? "The worker rejected the request.";
		record("in", method, parsed ?? { httpStatus: response.status }, code);
		throw new ProtocolError(code, message);
	}

	if (!text) {
		record("in", method, { httpStatus: response.status }, "accepted");
		return null;
	}

	const parsed = parseBody(text, contentType);
	record("in", method, parsed, parsed?.error ? "JSON-RPC error" : undefined);
	return parsed;
}

async function rpc(method, params) {
	const id = nextId;
	nextId += 1;
	const response = await post({ jsonrpc: "2.0", id, method, params });

	if (response?.error) {
		throw new ProtocolError(
			String(response.error.code ?? "RPC_ERROR"),
			response.error.message ?? "The server returned a JSON-RPC error.",
		);
	}

	if (response?.id !== id) {
		throw new ProtocolError(
			"ID_MISMATCH",
			"Response id does not match request.",
		);
	}

	return response.result;
}

async function notify(method, params) {
	await post({ jsonrpc: "2.0", method, params });
}

async function ensureSession() {
	if (session.initialized) return;

	const result = await rpc("initialize", {
		protocolVersion: PROTOCOL_VERSION,
		capabilities: {},
		clientInfo: CLIENT_INFO,
	});

	session.protocolVersion = result?.protocolVersion ?? PROTOCOL_VERSION;
	session.serverInfo = result?.serverInfo ?? null;

	await notify("notifications/initialized", {});

	const list = await rpc("tools/list", {});
	session.tools = list?.tools ?? [];

	session.initialized = true;
}

async function callTool(name, args, note) {
	const result = await rpc("tools/call", { name, arguments: args }, note);
	const meta = { ...lastMeta };

	// Failed calls carry the error only in the text part, not in structuredContent.
	let payload = result?.structuredContent ?? null;
	if (!payload) {
		try {
			payload = JSON.parse(result?.content?.[0]?.text ?? "null");
		} catch {
			payload = null;
		}
	}

	if (result?.isError) {
		throw new ProtocolError(
			payload?.error?.code ?? "TOOL_ERROR",
			payload?.error?.message ?? "The tool call failed.",
		);
	}

	return { payload, meta };
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

function setStatus(message, kind) {
	const status = $("status");
	status.textContent = message ?? "";
	status.className = `status${kind ? ` ${kind}` : ""}`;
}

function setBusy(busy) {
	$("search-btn").disabled = busy;
}

function renderStations(stations, onPick) {
	const container = $("stations");
	container.replaceChildren();

	if (stations.length === 0) {
		container.hidden = true;
		return;
	}

	for (const station of stations) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "station-btn";

		const name = document.createElement("span");
		name.textContent = station.name ?? "(unnamed station)";

		const eva = document.createElement("span");
		eva.className = "eva";
		eva.textContent = `EVA ${station.eva ?? "?"}`;

		button.append(name, eva);
		button.addEventListener("click", () => onPick(station));
		container.append(button);
	}

	container.hidden = false;
}

function badge(text, kind) {
	const span = document.createElement("span");
	span.className = `badge ${kind}`;
	span.textContent = text;
	return span;
}

function renderDeparture(departure) {
	const item = document.createElement("li");
	item.className = "dep";

	if (departure.cancelled) item.classList.add("cancelled");
	else if (departure.delayMinutes !== null && departure.delayMinutes !== 0)
		item.classList.add("changed");
	else if (departure.delayMinutes === 0 || departure.platformChanged)
		item.classList.add("changed");
	else if (departure.hasRealtime) item.classList.add("on-time");

	// The answer: effective time.
	const effective = document.createElement("div");
	effective.className = "dep-effective";
	effective.textContent = departure.effectiveHhmm ?? "–";
	const effectiveLabel = document.createElement("small");
	effectiveLabel.textContent = "effective";
	effective.append(effectiveLabel);
	item.append(effective);

	const body = document.createElement("div");
	body.className = "dep-body";

	const line = document.createElement("div");
	line.className = "dep-line";
	const label = document.createElement("span");
	label.className = "dep-label";
	label.textContent = departure.label ?? "?";
	line.append(label);
	if (departure.destination) {
		const dest = document.createElement("span");
		dest.className = "dep-dest";
		const arrow = document.createElement("span");
		arrow.className = "arrow";
		arrow.textContent = "→";
		dest.append(arrow, ` ${departure.destination}`);
		line.append(dest);
	}
	body.append(line);

	// The deviation: planned vs changed.
	const times = document.createElement("div");
	times.className = "dep-times";
	const planned = document.createElement("span");
	planned.textContent = "planned ";
	const plannedValue = document.createElement("b");
	plannedValue.textContent = departure.plannedHhmm ?? "–";
	planned.append(plannedValue);
	times.append(planned);

	const changed = document.createElement("span");
	changed.textContent = "changed ";
	const changedValue = document.createElement("b");
	changedValue.textContent = departure.changedHhmm ?? "none";
	changed.append(changedValue);
	times.append(changed);
	body.append(times);

	const badges = document.createElement("div");
	badges.className = "badges";

	if (departure.cancelled) {
		badges.append(badge("cancelled", "cancelled"));
	} else if (departure.delayMinutes === null) {
		badges.append(badge("no realtime data", "unknown"));
	} else if (departure.delayMinutes > 0) {
		badges.append(badge(`+${departure.delayMinutes} min`, "delay"));
	} else if (departure.delayMinutes < 0) {
		badges.append(badge(`${departure.delayMinutes} min`, "early"));
	} else {
		badges.append(badge("on time", "ok"));
	}

	if (departure.platformChanged) {
		badges.append(
			badge(
				`platform ${departure.plannedPlatform} → ${departure.effectivePlatform}`,
				"platform",
			),
		);
	} else if (departure.effectivePlatform) {
		badges.append(badge(`platform ${departure.effectivePlatform}`, "unknown"));
	}

	body.append(badges);

	const message = departure.messages.find((entry) => entry.text);
	if (message) {
		const text = document.createElement("p");
		text.className = "dep-msg";
		text.textContent = message.text;
		body.append(text);
	}

	item.append(body);
	return item;
}

function renderBoard(station, departures, meta, hourCount, hiddenArrivals) {
	$("board-title").textContent =
		`${station.name ?? "Station"} · EVA ${station.eva ?? "?"}`;

	const notes = [];
	if (meta.retrievedAt) {
		const age = ageSeconds(meta.retrievedAt);
		notes.push(
			`data from ${new Date(meta.retrievedAt).toLocaleString()} (${age} s old)`,
		);
	}
	notes.push(meta.fromCache ? "served from worker cache" : "fetched upstream");
	notes.push(
		`${meta.upstreamCalls} upstream call${meta.upstreamCalls === 1 ? "" : "s"} for this board`,
	);
	if (hiddenArrivals > 0) notes.push(`${hiddenArrivals} arrivals not shown`);

	const metaLine = $("board-meta");
	metaLine.replaceChildren(
		document.createTextNode(
			`${notes.join(" · ")} · ${hourCount} hour${hourCount === 1 ? "" : "s"} loaded`,
		),
	);
	if (meta.stale) {
		const stale = document.createElement("span");
		stale.className = "stale";
		stale.textContent =
			" · STALE: upstream unavailable, showing the last snapshot";
		metaLine.append(stale);
	}

	const list = $("board-list");
	list.replaceChildren();
	for (const departure of departures) {
		list.append(renderDeparture(departure));
	}

	$("board-empty").hidden = departures.length > 0;
	$("board").hidden = false;
}

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

async function runSearch(pattern) {
	if (NOT_CONFIGURED) {
		setStatus(CONFIGURATION_HINT, "error");
		return;
	}

	setBusy(true);
	setStatus("Searching stations…");

	try {
		await ensureSession();
		const { payload } = await callTool(
			"findStations",
			{ pattern },
			`search "${pattern}"`,
		);
		// The tool returns `evaNo`; the UI below uses `eva`.
		const stations = (payload?.data ?? []).map((station) => ({
			...station,
			eva: station.eva ?? station.evaNo,
		}));

		if (stations.length === 0) {
			setStatus(
				"No station matched. Try a city name or an EVA number.",
				"error",
			);
			$("stations").hidden = true;
			return;
		}

		setStatus(
			`${stations.length} station${stations.length === 1 ? "" : "s"} found. Pick one.`,
		);
		renderStations(stations, (station) => {
			void runBoard(station);
		});
	} catch (error) {
		handleError(error);
	} finally {
		setBusy(false);
	}
}

async function runBoard(station) {
	setBusy(true);
	setStatus(`Loading the board for ${station.name}…`);
	$("stations").hidden = true;

	try {
		await ensureSession();

		const now = berlinParts(new Date());
		const { payload, meta } = await callTool(
			"getStationBoard",
			{
				evaNo: String(station.eva),
				date: `${now.yy}${now.mm}${now.dd}`,
				hour: now.hh,
			},
			`board ${now.hh}:00`,
		);

		const stops = payload?.data?.stops ?? [];
		const departures = buildDepartures(stops);
		const arrivalOnly = stops.filter((stop) => !stop.departure).length;

		renderBoard(
			station,
			departures,
			{
				...meta,
				retrievedAt: meta.retrievedAt ?? payload?.retrievedAt ?? null,
			},
			1,
			arrivalOnly,
		);
		setStatus("");
	} catch (error) {
		handleError(error);
	} finally {
		setBusy(false);
	}
}

function handleError(error) {
	if (error instanceof ThrottledError) {
		setStatus(
			`Rate limited by the demo worker. Wait ${error.retryAfterSeconds} s before trying again — reloading makes it worse.`,
			"throttled",
		);
		return;
	}

	if (error instanceof ProtocolError) {
		const hint =
			error.code === "RATE_LIMITED" || error.code === "UPSTREAM_UNAVAILABLE"
				? " This is the demo's upstream quota, not your connection."
				: "";
		setStatus(`[${error.code}] ${error.message}${hint}`, "error");
		return;
	}

	setStatus(
		`Could not reach the worker at ${ENDPOINT}. Check the URL and that the origin is allowed by CORS.`,
		"error",
	);
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

$("search-form").addEventListener("submit", (event) => {
	event.preventDefault();
	const pattern = $("q").value.trim();
	if (pattern) void runSearch(pattern);
});

$("protocol-toggle").addEventListener("click", () => {
	const panel = $("protocol");
	const hidden = panel.hidden;
	panel.hidden = !hidden;
	$("protocol-toggle").textContent = hidden ? "Hide messages" : "Show messages";
	$("protocol-toggle").setAttribute("aria-expanded", String(hidden));
	if (hidden) renderProtocol();
});

if (NOT_CONFIGURED) {
	$("endpoint-note").hidden = false;
}

$("q").addEventListener("input", () => {
	$("stations").hidden = true;
});
