import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { Demo } from "@/components/demo/demo";
import { ExplainSections } from "@/components/explain";
import { RichText } from "@/components/rich-text";
import { getDictionary, isLocale } from "@/lib/i18n";

export default async function Page({ params }: PageProps<"/[lang]">) {
	const { lang } = await params;
	if (!isLocale(lang)) notFound();
	const dict = getDictionary(lang);

	return (
		<>
			<SiteHeader dict={dict} locale={lang} />
			<main className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:pt-14">
				<section className="max-w-2xl">
					<h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
						<RichText text={dict.lede.lead} />
					</h1>
					<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
						<RichText text={dict.lede.body} />
					</p>
					<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
						<RichText text={dict.lede.stateless} />
					</p>
				</section>

				<div className="mt-12">
					<Demo dict={dict} locale={lang} />
				</div>

				<div className="mt-20">
					<ExplainSections dict={dict} />
				</div>
			</main>
			<SiteFooter dict={dict} />
		</>
	);
}
