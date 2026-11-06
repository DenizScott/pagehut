import { de } from "./de";
import { en } from "./en";
import { generalDe, generalEn, generalTr } from "./general";
import { tr } from "./tr";
import { templateCategory, templateIcon, templateIds, type TemplateCategory, type TemplateId, type TemplateSet } from "./types";

/**
 * Page templates, written per language (not machine translated). A locale without its own set
 * falls back to English. To add a language, copy en.ts, translate it, and register it here.
 */
const sets: Record<string, TemplateSet> = {
  en: { ...generalEn, ...en },
  tr: { ...generalTr, ...tr },
  de: { ...generalDe, ...de },
};

export interface Template {
  id: TemplateId;
  icon: string;
  category: TemplateCategory;
  title: string;
  description: string;
  markdown: string;
}

export function getTemplates(locale: string): Template[] {
  const set = sets[locale] ?? sets.en;
  return templateIds.map((id) => ({ id, icon: templateIcon[id], category: templateCategory[id], ...set[id] }));
}

export { templateIds, type TemplateCategory, type TemplateId };
export const templateLocales = Object.keys(sets);
