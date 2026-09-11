"use client";

import { ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { type Dictionary, format } from "@/lib/i18n";
import type { Departure } from "@/lib/timetable";

type Tone = "cancel" | "delay" | "platform" | "neutral";

const toneClasses: Record<Tone, string> = {
	cancel: "border-status-cancel/35 bg-status-cancel-soft text-status-cancel",
	delay: "border-status-delay/35 bg-status-delay-soft text-status-delay",
	platform:
		"border-status-platform/35 bg-status-platform-soft text-status-platform",
	neutral: "border-border bg-secondary/60 text-muted-foreground",
};

function StatusChip({ tone, children }: { tone: Tone; children: ReactNode }) {
	return (
		<span
			className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tnum ${toneClasses[tone]}`}
		>
			{children}
		</span>
	);
}

function DepartureRow({
	departure,
	dict,
}: {
	departure: Departure;
	dict: Dictionary;
}) {
	const [open, setOpen] = useState(false);
	const labels = dict.board;

	const timeDeviates =
		departure.plannedHhmm !== null &&
		departure.changedHhmm !== null &&
		departure.plannedHhmm !== departure.changedHhmm;

	return (
		<li className="flex items-start gap-4 py-3">
			<div className="w-16 shrink-0">
				<div
					className={`font-mono text-2xl leading-none tnum ${
						departure.cancelled
							? "text-status-cancel line-through decoration-2"
							: "text-foreground"
					}`}
				>
					{departure.effectiveHhmm ?? "–"}
				</div>
				<div className="mt-1 text-[0.68rem] uppercase tracking-wide text-muted-foreground">
					{labels.time.effective}
				</div>
			</div>

			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
					<div className="flex min-w-0 items-center gap-2">
						{departure.label ? (
							<span className="shrink-0 rounded-md border border-border bg-card px-1.5 py-0.5 font-mono text-xs font-medium tnum">
								{departure.label}
							</span>
						) : null}
						{departure.destination ? (
							<span className="flex min-w-0 items-center gap-1 text-sm">
								<span aria-hidden className="text-muted-foreground">
									→
								</span>
								<span className="truncate">{departure.destination}</span>
							</span>
						) : null}
					</div>

					<div className="ml-auto flex flex-wrap items-center gap-1.5">
						{departure.cancelled ? (
							<StatusChip tone="cancel">{labels.status_.cancelled}</StatusChip>
						) : departure.delayMinutes === null ? (
							departure.hasRealtime ? null : (
								<StatusChip tone="neutral">
									{labels.status_.noRealtime}
								</StatusChip>
							)
						) : departure.delayMinutes > 0 ? (
							<StatusChip tone="delay">
								{format(labels.status_.delay, {
									minutes: departure.delayMinutes,
								})}
							</StatusChip>
						) : departure.delayMinutes < 0 ? (
							<StatusChip tone="delay">
								{format(labels.status_.early, {
									minutes: departure.delayMinutes,
								})}
							</StatusChip>
						) : (
							<StatusChip tone="neutral">{labels.status_.onTime}</StatusChip>
						)}

						{departure.platformChanged ? (
							<StatusChip tone="platform">
								{format(labels.status_.platformChanged, {
									from: departure.plannedPlatform ?? "–",
									to: departure.effectivePlatform ?? "–",
								})}
							</StatusChip>
						) : departure.effectivePlatform ? (
							<StatusChip tone="neutral">
								{format(labels.status_.platform, {
									platform: departure.effectivePlatform,
								})}
							</StatusChip>
						) : null}
					</div>
				</div>

				{timeDeviates ? (
					<div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground tnum">
						<span>
							{labels.time.planned}{" "}
							<span className="text-foreground">
								{departure.plannedHhmm ?? "–"}
							</span>
						</span>
						<span aria-hidden>·</span>
						<span>
							{labels.time.changed}{" "}
							<span className="text-foreground">
								{departure.changedHhmm ?? labels.time.changedNone}
							</span>
						</span>
					</div>
				) : null}

				{departure.messages.length > 0 ? (
					<Collapsible open={open} onOpenChange={setOpen} className="mt-2">
						<CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
							<ChevronRight
								className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`}
								aria-hidden
							/>
							{labels.messages.summary} ({departure.messages.length})
						</CollapsibleTrigger>
						<CollapsibleContent className="mt-1.5 space-y-1.5 border-l-2 border-border pl-3">
							{departure.messages.map((message) =>
								message.text ? (
									<p
										key={message.id}
										className="text-xs leading-relaxed text-muted-foreground"
									>
										{message.text}
									</p>
								) : null,
							)}
						</CollapsibleContent>
					</Collapsible>
				) : null}
			</div>
		</li>
	);
}

export function DepartureList({
	departures,
	dict,
}: {
	departures: Departure[];
	dict: Dictionary;
}) {
	if (departures.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
				<p className="text-sm font-medium">{dict.board.empty.title}</p>
				<p className="mx-auto mt-1 max-w-prose text-xs text-muted-foreground">
					{dict.board.empty.hint}
				</p>
			</div>
		);
	}

	return (
		<ol className="divide-y divide-border border-t border-border">
			{departures.map((departure) => (
				<DepartureRow
					key={departure.stopId}
					departure={departure}
					dict={dict}
				/>
			))}
		</ol>
	);
}
