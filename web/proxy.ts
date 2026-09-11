import { type NextRequest, NextResponse } from "next/server";
import { defaultLocale, isLocale, type Locale, locales } from "@/lib/locales";

/*
 * Spracherkennung und Weiterleitung. Next 16 nennt die frühere Middleware
 * "Proxy". Eine Anfrage ohne Sprachpräfix wird auf die bevorzugte Sprache
 * umgeleitet, damit /en und /de teilbare, indexierbare URLs sind.
 */
function detectLocale(request: NextRequest): Locale {
	const header = request.headers.get("accept-language") ?? "";
	const tags = header
		.split(",")
		.map((part) => part.split(";")[0]?.trim().toLowerCase() ?? "")
		.map((tag) => tag.split("-")[0]);

	for (const tag of tags) {
		if (isLocale(tag)) return tag;
	}
	return defaultLocale;
}

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	const hasLocale = locales.some(
		(locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
	);
	if (hasLocale) return;

	const url = request.nextUrl.clone();
	url.pathname = `/${detectLocale(request)}${pathname === "/" ? "" : pathname}`;
	return NextResponse.redirect(url);
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
