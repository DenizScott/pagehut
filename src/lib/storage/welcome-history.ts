/**
 * Every text the app has ever generated for a new workspace, in every language: the welcome page
 * (title and body) and the default workspace name. Used to recognize content the user never
 * touched, so it can follow the current language and wording (see localize-defaults.ts).
 *
 * When welcome.title, welcome.body or shell.workspaceName change in locales/, add the new values
 * here too, or workspaces created with them will keep their old text.
 */

export const WELCOME_TITLES: readonly string[] = [
  "Willkommen bei {appName}",
  "Welcome to {appName}",
  "{appName} uygulamasına hoş geldin"
];

export const WELCOME_BODIES: readonly string[] = [
  "{appName} ist ein kostenloser Arbeitsbereich für **Game-Design-Dokumente**.\n\n:::callout idea\nTippe irgendwo `/`, um Überschriften, To-dos, Aufklapper, Hinweisboxen, Tabellen und mehr einzufügen.\n:::\n\n## Probier es aus\n\n- [ ] Schreib den Ein-Satz-Pitch deines Spiels\n- [ ] Lege drei Design-Pillars fest\n- [ ] Beschreibe den Core Loop\n\n:::toggle Wo wird meine Arbeit gespeichert?\nIm lokalen Modus bleibt alles in diesem Browser (IndexedDB). Später kannst du ein GitHub-Repository verbinden, damit dein Team am selben GDD arbeitet.\n:::\n",
  "{appName} ist ein kostenloser Arbeitsbereich für alles, was du schreibst und planst: Videoskripte, Blogartikel, Notizen, Projekte, Game-Design-Dokumente und mehr.\n\n:::callout idea\nTippe irgendwo `/`, um Überschriften, To-dos, Aufklapper, Hinweisboxen, Tabellen und mehr einzufügen.\n:::\n\n## Probier es aus\n\n- [ ] Starte eine Seite mit einer Vorlage (Vorlagen in der Seitenleiste)\n- [ ] Verknüpfe zwei Seiten, indem du `[[` tippst\n- [ ] Plane etwas in einer Datenbank: Aufgaben, einen Content-Kalender, eine Leseliste\n\n:::toggle Wo wird meine Arbeit gespeichert?\nIm lokalen Modus bleibt alles auf diesem Gerät. Später kannst du ein GitHub-Repository verbinden, damit dein Team an denselben Seiten arbeitet.\n:::\n",
  "{appName} is a free workspace for **game design documents**.\n\n:::callout idea\nType `/` anywhere to insert headings, to-dos, toggles, callouts, tables and more.\n:::\n\n## Try it\n\n- [ ] Write your game's one-sentence pitch\n- [ ] List three design pillars\n- [ ] Describe the core loop\n\n:::toggle Where is my work stored?\nIn local mode everything stays in this browser (IndexedDB). Later you can connect a GitHub repository so your team can work on the same GDD.\n:::\n",
  "{appName} is a free workspace for everything you write and plan: video scripts, blog posts, notes, projects, game design documents and more.\n\n:::callout idea\nType `/` anywhere to insert headings, to-dos, toggles, callouts, tables and more.\n:::\n\n## Try it\n\n- [ ] Start a page from a template (Templates in the sidebar)\n- [ ] Link two pages by typing `[[`\n- [ ] Plan something in a database: tasks, a content calendar, a reading list\n\n:::toggle Where is my work stored?\nIn local mode everything stays on this device. Later you can connect a GitHub repository so your team works on the same pages.\n:::\n",
  "{appName}, **oyun tasarım dokümanları** (GDD) için ücretsiz bir çalışma alanı.\n\n:::callout idea\nBaşlık, yapılacaklar, açılır blok, bilgi kutusu, tablo ve daha fazlasını eklemek için herhangi bir yere `/` yaz.\n:::\n\n## Dene\n\n- [ ] Oyununun tek cümlelik tanıtımını (pitch) yaz\n- [ ] Üç tasarım ilkesi (design pillar) belirle\n- [ ] Çekirdek döngüyü (core loop) anlat\n\n:::toggle Çalışmalarım nerede saklanıyor?\nYerel modda her şey bu tarayıcıda (IndexedDB) kalır. Daha sonra bir GitHub deposu bağlayarak ekibinle aynı GDD üzerinde çalışabilirsin.\n:::\n",
  "{appName}, yazdığın ve planladığın her şey için ücretsiz bir çalışma alanı: video senaryoları, blog yazıları, notlar, projeler, oyun tasarım belgeleri ve daha fazlası.\n\n:::callout idea\nBaşlık, yapılacaklar, açılır blok, bilgi kutusu, tablo ve daha fazlasını eklemek için herhangi bir yere `/` yaz.\n:::\n\n## Dene\n\n- [ ] Bir şablondan sayfa başlat (kenar çubuğunda Şablonlar)\n- [ ] `[[` yazarak iki sayfayı birbirine bağla\n- [ ] Bir veritabanında plan yap: görevler, içerik takvimi, okuma listesi\n\n:::toggle Çalışmalarım nerede saklanıyor?\nYerel modda her şey bu cihazda kalır. Daha sonra bir GitHub deposu bağlayarak ekibinle aynı sayfalar üzerinde çalışabilirsin.\n:::\n"
];

export const DEFAULT_WORKSPACE_NAMES: readonly string[] = [
  "Mein GDD",
  "Mein Spiel",
  "Mein Arbeitsbereich",
  "My GDD",
  "My game",
  "My workspace",
  "GDD Çalışma Alanım",
  "Oyunum",
  "Çalışma alanım"
];
