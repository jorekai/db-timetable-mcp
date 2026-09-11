/*
 * Sprachkonstanten ohne Wörterbücher. Eigene Datei, damit der Proxy (Edge)
 * nur diese wenigen Bytes lädt und nicht die gesamten UI-Texte.
 */

export const locales = ["en", "de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(value: string): value is Locale {
	return (locales as readonly string[]).includes(value);
}
