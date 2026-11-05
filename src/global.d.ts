import type common from "../locales/en/common.json";
import type editor from "../locales/en/editor.json";
import type slash from "../locales/en/slash.json";
import type database from "../locales/en/database.json";
import type { locales } from "./i18n/routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof locales)[number];
    Messages: { common: typeof common; editor: typeof editor; slash: typeof slash; database: typeof database };
  }
}
