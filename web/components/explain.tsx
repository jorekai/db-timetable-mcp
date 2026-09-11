import type { ReactNode } from "react";
import { RichText } from "@/components/rich-text";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Dictionary } from "@/lib/i18n";

function Block({
	id,
	heading,
	children,
}: {
	id?: string;
	heading: string;
	children: ReactNode;
}) {
	return (
		<section id={id} className="scroll-mt-20">
			<h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
			<div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
				{children}
			</div>
		</section>
	);
}

export function ExplainSections({ dict }: { dict: Dictionary }) {
	const about = dict.about;
	const attribution = dict.attribution;
	const privacy = dict.privacy;

	return (
		<div className="space-y-14">
			<Block id="about" heading={about.mcp.heading}>
				<p className="text-base text-foreground">
					<RichText text={about.mcp.p1} />
				</p>
				<p>
					<RichText text={about.mcp.p2} />
				</p>
				<p>
					<RichText text={about.mcp.p3} />
				</p>
			</Block>

			<div className="grid gap-10 md:grid-cols-2">
				<Block heading={about.time.heading}>
					<p>
						<RichText text={about.time.intro} />
					</p>
					<dl className="space-y-3">
						<div>
							<dt className="font-mono text-xs font-medium text-foreground">
								planned
							</dt>
							<dd className="mt-0.5">
								<RichText text={about.time.planned} />
							</dd>
						</div>
						<div>
							<dt className="font-mono text-xs font-medium text-foreground">
								changed
							</dt>
							<dd className="mt-0.5">
								<RichText text={about.time.changed} />
							</dd>
						</div>
						<div>
							<dt className="font-mono text-xs font-medium text-foreground">
								effective
							</dt>
							<dd className="mt-0.5">
								<RichText text={about.time.effective} />
							</dd>
						</div>
					</dl>
				</Block>

				<Block heading={about.cache.heading}>
					<p>
						<RichText text={about.cache.p1} />
					</p>
					<p>
						<RichText text={about.cache.p2} />
					</p>
					<p>
						<RichText text={about.cache.p3} />
					</p>
				</Block>

				<Block heading={about.tools.heading}>
					<p>
						<RichText text={about.tools.intro} />
					</p>
					<ul className="space-y-1.5">
						{[
							about.tools.stationBoard,
							about.tools.planned,
							about.tools.current,
							about.tools.recent,
							about.tools.stations,
						].map((entry) => (
							<li key={entry} className="border-l border-border pl-3">
								<RichText text={entry} />
							</li>
						))}
					</ul>
					<p>
						<RichText text={about.tools.resources} />
					</p>
				</Block>
			</div>

			<Block heading={about.limits.heading}>
				<p className="max-w-prose">
					<RichText text={about.limits.intro} />
				</p>
				<div className="overflow-x-auto rounded-lg border border-border">
					<Table>
						<TableHeader>
							<TableRow>
								{about.limits.columns.map((column) => (
									<TableHead key={column}>{column}</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{about.limits.rows.map(([resource, limit, effect]) => (
								<TableRow key={resource}>
									<TableCell className="font-medium text-foreground">
										{resource}
									</TableCell>
									<TableCell className="whitespace-nowrap tnum">
										<RichText text={limit} />
									</TableCell>
									<TableCell>
										<RichText text={effect} />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</Block>

			<div className="grid gap-10 md:grid-cols-2">
				<Block heading={attribution.heading}>
					<p>
						<RichText text={attribution.p1} />
					</p>
					<p className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-foreground">
						{attribution.line}
					</p>
					<p className="text-xs">
						<RichText text={attribution.note} />
					</p>
				</Block>

				<Block heading={privacy.heading}>
					<ul className="space-y-2">
						{privacy.items.map((item) => (
							<li key={item} className="flex gap-2">
								<span aria-hidden className="text-muted-foreground/50">
									·
								</span>
								<RichText text={item} />
							</li>
						))}
					</ul>
				</Block>
			</div>
		</div>
	);
}
