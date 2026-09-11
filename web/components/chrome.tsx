import Link from "next/link";
import { type Dictionary, type Locale, locales } from "@/lib/i18n";

function LocaleSwitch({ dict, locale }: { dict: Dictionary; locale: Locale }) {
	return (
		<nav
			aria-label={dict.header.language}
			className="flex items-center rounded-md border border-border p-0.5 text-xs font-medium"
		>
			{locales.map((option) => {
				const active = option === locale;
				return (
					<Link
						key={option}
						href={`/${option}`}
						hrefLang={option}
						aria-current={active ? "true" : undefined}
						className={`rounded px-2 py-1 uppercase tracking-wide transition-colors ${
							active
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						{option}
					</Link>
				);
			})}
		</nav>
	);
}

export function SiteHeader({
	dict,
	locale,
}: {
	dict: Dictionary;
	locale: Locale;
}) {
	const nav = [
		{ href: "#board", label: dict.header.navBoard },
		{ href: "#protocol", label: dict.header.navProtocol },
		{ href: "#about", label: dict.header.navAbout },
	];
	return (
		<header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
			<div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
				<Link
					href={`/${locale}`}
					className="flex items-baseline gap-2 whitespace-nowrap"
				>
					<span className="text-sm font-semibold tracking-tight">
						{dict.header.brand}
					</span>
					<span className="hidden text-xs text-muted-foreground sm:inline">
						{dict.header.tag}
					</span>
				</Link>
				<nav className="ml-auto hidden items-center gap-4 text-sm md:flex">
					{nav.map((item) => (
						<a
							key={item.href}
							href={item.href}
							className="text-muted-foreground transition-colors hover:text-foreground"
						>
							{item.label}
						</a>
					))}
				</nav>
				<div className="ml-auto md:ml-0">
					<LocaleSwitch dict={dict} locale={locale} />
				</div>
			</div>
		</header>
	);
}

export function SiteFooter({ dict }: { dict: Dictionary }) {
	return (
		<footer className="mt-20 border-t border-border">
			<div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
				<p>{dict.footer.note}</p>
				<p>
					{dict.footer.source}:{" "}
					<a
						href="https://github.com/jorekai/db-timetable-mcp"
						rel="noopener noreferrer"
						className="underline underline-offset-2 hover:text-foreground"
					>
						jorekai/db-timetable-mcp
					</a>
				</p>
			</div>
		</footer>
	);
}
