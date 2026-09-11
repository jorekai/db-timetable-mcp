"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type Dictionary, format, type Locale } from "@/lib/i18n";
import type { CacheMeta, McpLogEntry } from "@/lib/mcp";
import type { ToolDescriptor } from "@/lib/types";

function methodMeaning(method: string, dict: Dictionary): string | undefined {
	switch (method) {
		case "initialize":
			return dict.protocol.meaning.initialize;
		case "notifications/initialized":
			return dict.protocol.meaning.initialized;
		case "tools/list":
			return dict.protocol.meaning.toolsList;
		case "tools/call":
			return dict.protocol.meaning.toolsCall;
		default:
			return undefined;
	}
}

interface SchemaField {
	name: string;
	type: string;
	required: boolean;
}

function schemaFields(schema: unknown): SchemaField[] {
	if (!schema || typeof schema !== "object") return [];
	const shaped = schema as {
		properties?: Record<string, { type?: string }>;
		required?: string[];
	};
	const required = new Set(shaped.required ?? []);
	return Object.entries(shaped.properties ?? {}).map(([name, value]) => ({
		name,
		type: value?.type ?? "any",
		required: required.has(name),
	}));
}

function CacheState({ meta, dict }: { meta: CacheMeta; dict: Dictionary }) {
	const labels = dict.protocol.cache;
	const cacheLabel =
		meta.cache === "hit"
			? labels.hit
			: meta.cache === "miss"
				? labels.miss
				: labels.unknown;

	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
			<span className="font-medium text-foreground">{cacheLabel}</span>
			{meta.upstreamCalls > 0 ? (
				<span>
					{format(labels.upstreamCalls, { count: meta.upstreamCalls })}
				</span>
			) : null}
			{meta.stale ? (
				<span className="text-status-delay">{labels.stale}</span>
			) : null}
		</div>
	);
}

function LogEntry({
	entry,
	dict,
	locale,
}: {
	entry: McpLogEntry;
	dict: Dictionary;
	locale: Locale;
}) {
	const meaning = methodMeaning(entry.method, dict);
	return (
		<li>
			<details className="group">
				<summary className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 text-sm hover:bg-accent/50">
					<ChevronRight
						className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
						aria-hidden
					/>
					<span
						className={`shrink-0 rounded border px-1.5 py-0.5 text-[0.7rem] font-medium ${
							entry.direction === "out"
								? "border-status-platform/35 bg-status-platform-soft text-status-platform"
								: "border-border bg-secondary/60 text-muted-foreground"
						}`}
					>
						{entry.direction === "out"
							? dict.protocol.sent
							: dict.protocol.received}
					</span>
					<code className="font-mono text-xs">{entry.method}</code>
					{entry.note ? (
						<span className="text-xs text-muted-foreground">{entry.note}</span>
					) : null}
					<span className="ml-auto text-[0.7rem] text-muted-foreground tnum">
						{new Date(entry.at).toLocaleTimeString(locale)}
					</span>
				</summary>
				<div className="border-t border-border bg-secondary/30 px-4 py-3">
					{meaning ? (
						<p className="mb-2 max-w-prose text-xs text-muted-foreground">
							{meaning}
						</p>
					) : null}
					{entry.trimmed ? (
						<p className="mb-2 text-xs text-status-delay">
							{format(dict.protocol.truncated, { bytes: entry.bytes ?? 0 })}
						</p>
					) : null}
					<pre className="max-h-72 overflow-auto rounded-md border border-border bg-background p-3 text-xs leading-relaxed">
						<code>{JSON.stringify(entry.payload, null, 2)}</code>
					</pre>
				</div>
			</details>
		</li>
	);
}

export function ProtocolLog({
	logs,
	tools,
	meta,
	dict,
	locale,
}: {
	logs: McpLogEntry[];
	tools: ToolDescriptor[];
	meta: CacheMeta;
	dict: Dictionary;
	locale: Locale;
}) {
	const [visible, setVisible] = useState(false);

	return (
		<section
			id="protocol"
			aria-labelledby="protocol-heading"
			className="scroll-mt-20"
		>
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="max-w-prose">
					<h2
						id="protocol-heading"
						className="text-lg font-semibold tracking-tight"
					>
						{dict.protocol.heading}
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{dict.protocol.intro}
					</p>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setVisible((value) => !value)}
					aria-expanded={visible}
					aria-controls="protocol-body"
				>
					{visible ? dict.protocol.hide : dict.protocol.show}
				</Button>
			</div>

			<div className="mt-4 rounded-lg border border-border">
				<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
					<span className="text-xs font-medium">
						{format(dict.protocol.count, { count: logs.length })}
					</span>
					<CacheState meta={meta} dict={dict} />
				</div>

				{visible ? (
					<div id="protocol-body">
						{logs.length === 0 ? (
							<p className="px-4 py-6 text-sm text-muted-foreground">
								{dict.protocol.empty}
							</p>
						) : (
							<ul className="max-h-[28rem] divide-y divide-border overflow-auto">
								{logs.map((entry) => (
									<LogEntry
										key={entry.seq}
										entry={entry}
										dict={dict}
										locale={locale}
									/>
								))}
							</ul>
						)}
					</div>
				) : null}
			</div>

			<div className="mt-4">
				<h3 className="text-sm font-semibold">{dict.protocol.toolsHeading}</h3>
				{tools.length === 0 ? (
					<p className="mt-1 text-sm text-muted-foreground">
						{dict.protocol.toolsEmpty}
					</p>
				) : (
					<ul className="mt-2 divide-y divide-border rounded-lg border border-border">
						{tools.map((tool) => {
							const fields = schemaFields(tool.inputSchema);
							return (
								<li key={tool.name} className="px-4 py-3">
									<div className="flex flex-wrap items-baseline gap-x-2">
										<code className="font-mono text-sm font-medium">
											{tool.name}
										</code>
										{tool.title ? (
											<span className="text-xs text-muted-foreground">
												{tool.title}
											</span>
										) : null}
									</div>
									{tool.description ? (
										<p className="mt-1 max-w-prose text-xs text-muted-foreground">
											{tool.description}
										</p>
									) : null}
									{fields.length > 0 ? (
										<div className="mt-1.5 flex flex-wrap gap-1.5">
											{fields.map((field) => (
												<span
													key={field.name}
													className="rounded border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground"
												>
													{field.name}: {field.type}
													{field.required ? "" : "?"}
												</span>
											))}
										</div>
									) : null}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</section>
	);
}
