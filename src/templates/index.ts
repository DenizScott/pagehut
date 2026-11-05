import { de } from "./de";
import { en } from "./en";
import { tr } from "./tr";
import { templateCategory, templateIcon, templateIds, type TemplateCategory, type TemplateId, type TemplateSet } from "./types";

/**
 * GDD templates, written per language (not machine translated). A locale without its own set
 * falls back to English. To add a language, copy en.ts, translate it, and register it here.
 */
const sets: Record<string, TemplateSet> = { en, tr, de };

export interface Template {
  id: TemplateId;
  icon: string;
  category: TemplateCategory;
  title: string;
  description: string;
  markdown: string;
}

export function getTemplates(locale: string): Template[] {
  const set = sets[locale] ?? en;
  return templateIds.map((id) => ({ id, icon: templateIcon[id], category: templateCategory[id], ...set[id] }));
}

export { templateIds, type TemplateCategory, type TemplateId };
export const templateLocales = Object.keys(sets);
