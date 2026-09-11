// biome-ignore-all lint/suspicious/noArrayIndexKey: die Textsegmente sind pro Render stabil
import { Fragment } from "react";

/*
 * Rendert Text mit Inline-Code. `Backticks` werden zu <code>. Bewusst kein
 * Markdown-Parser: die Wörterbücher nutzen nur diese eine Auszeichnung.
 */
export function RichText({ text }: { text: string }) {
	const parts = text.split("`");
	return (
		<>
			{parts.map((part, index) =>
				index % 2 === 1 ? (
					<code
						key={`code-${index}`}
						className="rounded bg-secondary px-1 py-0.5 text-[0.85em] text-foreground"
					>
						{part}
					</code>
				) : (
					<Fragment key={`text-${index}`}>{part}</Fragment>
				),
			)}
		</>
	);
}

/** Absatzliste aus einem Wörterbuch-Array. */
export function RichParagraphs({
	texts,
	className,
}: {
	texts: readonly string[];
	className?: string;
}) {
	return (
		<>
			{texts.map((text) => (
				<p key={text} className={className}>
					<RichText text={text} />
				</p>
			))}
		</>
	);
}
