import type { View, ViewType } from "@/lib/database/types";

/**
 * Default view names in every language. A view still called by its type's default name (from a
 * template or "Add a view") is shown with that name in the current language; renamed views keep
 * the name the user gave them. Only the display changes, never the stored data.
 */
const DEFAULT_VIEW_NAMES: Record<ViewType, readonly string[]> = {
  table: ["Table", "Tablo", "Tabelle"],
  board: ["Board", "Pano"],
  gallery: ["Gallery", "Galeri", "Galerie"],
  calendar: ["Calendar", "Takvim", "Kalender"],
  timeline: ["Timeline", "Zaman çizelgesi", "Zeitleiste"],
  chart: ["Chart", "Grafik", "Diagramm"],
  form: ["Form", "Formular"],
};

export function viewDisplayName(view: Pick<View, "name" | "type">, t: (key: `views.${ViewType}`) => string): string {
  return DEFAULT_VIEW_NAMES[view.type].includes(view.name) ? t(`views.${view.type}`) : view.name;
}
