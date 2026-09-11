import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getDictionary, isLocale, locales } from "@/lib/i18n";
import "../globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export function generateStaticParams() {
	return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ lang: string }>;
}): Promise<Metadata> {
	const { lang } = await params;
	if (!isLocale(lang)) return {};
	const dict = getDictionary(lang);
	return {
		title: dict.meta.title,
		description: dict.meta.description,
	};
}

export default async function LocaleLayout({
	children,
	params,
}: LayoutProps<"/[lang]">) {
	const { lang } = await params;
	if (!isLocale(lang)) notFound();

	return (
		<html lang={lang} className={`${geistSans.variable} ${geistMono.variable}`}>
			<body className="min-h-dvh bg-background text-foreground antialiased">
				<TooltipProvider>{children}</TooltipProvider>
			</body>
		</html>
	);
}
