import { defineRouting } from "next-intl/routing";

/** Locales shipped at launch. To add one, see CONTRIBUTING.md#translations. */
export const locales = ["tr", "en", "de"] as const;
export type Locale = (typeof locales)[number];

/** Right-to-left locales. Arabic etc. go here when added; layout uses logical CSS properties. */
export const rtlLocales: readonly string[] = ["ar", "fa", "he", "ur"];

export const namespaces = ["common", "editor", "slash"] as const;

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localeDetection: true,
});

export function dirFor(locale: string): "ltr" | "rtl" {
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}
