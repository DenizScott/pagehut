"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};
/** true only after hydration; the theme is unknown on the server. */
function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

export function ThemeSwitcher() {
  const t = useTranslations("common.settings");
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const options = [
    { value: "light", label: t("themeLight"), Icon: Sun },
    { value: "dark", label: t("themeDark"), Icon: Moon },
    { value: "system", label: t("themeSystem"), Icon: Monitor },
  ] as const;

  return (
    <div role="radiogroup" aria-label={t("theme")} className="flex rounded-md bg-surface-hover p-0.5">
      {options.map(({ value, label, Icon }) => {
        const checked = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "flex flex-1 items-center justify-center rounded py-1 text-fg-muted hover:text-fg",
              checked && "bg-surface text-fg shadow-sm",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

const localeNames: Record<Locale, string> = { tr: "Türkçe", en: "English", de: "Deutsch" };

export function LocaleSwitcher() {
  const t = useTranslations("common.settings");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="flex items-center gap-2 text-xs text-fg-muted">
      <span className="shrink-0">{t("language")}</span>
      <select
        value={locale}
        onChange={(e) => router.replace(pathname, { locale: e.target.value as Locale })}
        className="min-w-0 flex-1 rounded-md border border-hairline bg-surface px-2 py-1 text-sm text-fg"
      >
        {locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {localeNames[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
