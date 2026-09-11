"use client";

import { AlertTriangle, Info, Loader2, RefreshCw, Search } from "lucide-react";
import { type FormEvent, useState } from "react";
import { DepartureList } from "@/components/demo/departure-list";
import { ProtocolLog } from "@/components/demo/protocol-log";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { type Dictionary, format, type Locale } from "@/lib/i18n";
import { ageSeconds } from "@/lib/timetable";
import { useDemo } from "./use-demo";

function StatusLine({
	text,
	tone,
}: {
	text: string;
	tone?: "error" | "muted";
}) {
	return (
		<p
			aria-live="polite"
			className={`min-h-5 text-sm ${
				tone === "error"
					? "text-status-cancel"
					: tone === "muted"
						? "text-muted-foreground"
						: ""
			}`}
		>
			{text}
		</p>
	);
}

export function Demo({ dict, locale }: { dict: Dictionary; locale: Locale }) {
	const demo = useDemo();
	const [pattern, setPattern] = useState("");
	const labels = dict.board;

	const submit = (event: FormEvent) => {
		event.preventDefault();
		void demo.search(pattern);
	};

	const statusText = (() => {
		switch (demo.status.kind) {
			case "searching":
				return dict.board.status.searching;
			case "found":
				return format(dict.board.status.found, { count: demo.status.count });
			case "noMatch":
				return dict.board.status.noMatch;
			case "loading":
				return format(dict.board.status.loading, { name: demo.status.name });
			default:
				return "";
		}
	})();

	const errorView = (() => {
		if (!demo.error) return null;
		const errors = dict.board.errors;
		if (demo.error.kind === "rate") {
			return {
				title: "Rate limit",
				body: format(errors.rateLimited, { seconds: demo.error.seconds }),
				tone: "delay" as const,
			};
		}
		if (demo.error.kind === "upstream") {
			return {
				title: demo.error.code,
				body: `${demo.error.message} ${errors.upstream}`,
				tone: "cancel" as const,
			};
		}
		return {
			title: demo.error.code,
			body: format(errors.generic, { endpoint: demo.endpoint }),
			tone: "cancel" as const,
		};
	})();

	const board = demo.board;
	const age = board ? ageSeconds(board.meta.retrievedAt) : null;

	return (
		<div className="space-y-16">
			<section
				id="board"
				aria-labelledby="board-heading"
				className="scroll-mt-20"
			>
				<div className="max-w-prose">
					<h2
						id="board-heading"
						className="text-lg font-semibold tracking-tight"
					>
						{labels.heading}
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">{labels.intro}</p>
				</div>

				<form onSubmit={submit} className="mt-4">
					<label htmlFor="station-input" className="text-sm font-medium">
						{labels.searchLabel}
					</label>
					<div className="mt-1.5 flex gap-2">
						<Input
							id="station-input"
							type="search"
							name="station"
							autoComplete="off"
							placeholder={labels.searchPlaceholder}
							value={pattern}
							onChange={(event) => setPattern(event.target.value)}
							className="max-w-sm"
						/>
						<Button
							type="submit"
							disabled={demo.busy || pattern.trim().length === 0}
						>
							{demo.busy ? (
								<Loader2 className="size-4 animate-spin" aria-hidden />
							) : (
								<Search className="size-4" aria-hidden />
							)}
							{labels.searchButton}
						</Button>
					</div>
				</form>

				<div className="mt-4">
					<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						{labels.examplesLabel}
					</p>
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{labels.examples.map((example) => (
							<Button
								key={example}
								type="button"
								variant="outline"
								size="sm"
								onClick={() => {
									setPattern(example);
									void demo.search(example);
								}}
							>
								{example}
							</Button>
						))}
					</div>
				</div>

				{demo.stations.length > 0 ? (
					<ul className="mt-4 divide-y divide-border rounded-lg border border-border">
						{demo.stations.map((station) => (
							<li key={`${station.evaNo}-${station.ds100}`}>
								<button
									type="button"
									onClick={() => void demo.openStation(station)}
									className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-accent/50"
								>
									<span className="font-medium">{station.name}</span>
									<span className="shrink-0 font-mono text-xs text-muted-foreground tnum">
										{format(labels.station.eva, { eva: station.evaNo })}
									</span>
								</button>
							</li>
						))}
					</ul>
				) : null}

				{errorView ? (
					<Alert
						variant="destructive"
						className={
							errorView.tone === "delay"
								? "mt-4 border-status-delay/40 text-status-delay"
								: "mt-4"
						}
					>
						<AlertTriangle className="size-4" aria-hidden />
						<AlertTitle className="tnum">{errorView.title}</AlertTitle>
						<AlertDescription>{errorView.body}</AlertDescription>
					</Alert>
				) : null}

				<div className="mt-3">
					<StatusLine
						text={statusText}
						tone={demo.status.kind === "noMatch" ? "error" : "muted"}
					/>
				</div>

				{demo.status.kind === "loading" && !board ? (
					<div className="mt-4 space-y-3">
						<Skeleton className="h-4 w-56" />
						{[0, 1, 2, 3, 4].map((row) => (
							<Skeleton key={row} className="h-14 w-full" />
						))}
					</div>
				) : null}

				{board ? (
					<div className="mt-4">
						<div className="flex flex-wrap items-end justify-between gap-3">
							<div>
								<h3 className="text-base font-semibold tracking-tight">
									{format(labels.title, {
										name: board.station.name,
										eva: board.station.evaNo,
									})}
								</h3>
								<p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tnum">
									{board.meta.retrievedAt ? (
										<span>
											{format(labels.meta.dataFrom, {
												time: new Date(
													board.meta.retrievedAt,
												).toLocaleTimeString(locale),
												age: age ?? 0,
											})}
										</span>
									) : null}
									<span aria-hidden>·</span>
									<span>
										{board.meta.cache === "hit"
											? labels.meta.fromCache
											: labels.meta.fromUpstream}
									</span>
									<span aria-hidden>·</span>
									<span>
										{format(labels.meta.upstreamCalls, {
											count: board.meta.upstreamCalls,
										})}
									</span>
									{board.hiddenArrivals > 0 ? (
										<>
											<span aria-hidden>·</span>
											<span>
												{format(labels.meta.hiddenArrivals, {
													count: board.hiddenArrivals,
												})}
											</span>
										</>
									) : null}
								</p>
								{board.meta.stale ? (
									<p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-status-delay">
										<Info className="size-3.5" aria-hidden />
										{labels.meta.stale}
									</p>
								) : null}
							</div>

							<div className="flex items-center gap-3">
								{demo.busy ? (
									<Loader2
										className="size-3.5 animate-spin text-muted-foreground"
										aria-hidden
									/>
								) : null}
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => void demo.refresh()}
									disabled={demo.busy}
								>
									<RefreshCw className="size-4" aria-hidden />
									{labels.refresh.refreshNow}
								</Button>
								<label
									htmlFor="auto-refresh"
									className="flex items-center gap-2 text-xs"
								>
									<Switch
										id="auto-refresh"
										checked={demo.refreshEnabled}
										onCheckedChange={demo.setRefreshEnabled}
										aria-label={labels.refresh.autoRefresh}
									/>
									<span className="text-muted-foreground">
										{demo.refreshEnabled
											? format(labels.refresh.nextIn, {
													seconds: demo.secondsLeft,
												})
											: labels.refresh.paused}
									</span>
								</label>
							</div>
						</div>

						{demo.stale ? (
							<p className="mt-2 text-xs text-status-delay">
								{labels.refresh.stalePaused}
							</p>
						) : null}

						<div className="mt-3">
							<DepartureList departures={board.departures} dict={dict} />
						</div>
					</div>
				) : null}
			</section>

			<ProtocolLog
				logs={demo.logs}
				tools={demo.tools}
				meta={demo.meta}
				dict={dict}
				locale={locale}
			/>
		</div>
	);
}
