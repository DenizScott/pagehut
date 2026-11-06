import { ulid } from "ulid";
import type { DatabaseData, OptionColor, Property, Row, View } from "@/lib/database/types";

/**
 * Game-design database templates, localized per language (names, options and sample rows).
 * Each build() returns fresh ids, so a template can be used many times in one workspace.
 */

export const databaseTemplateIds = ["mechanics", "scope", "story-beats", "playtests", "schedule", "balance", "moodboard"] as const;
export type DatabaseTemplateId = (typeof databaseTemplateIds)[number];

export interface DatabaseTemplate {
  id: DatabaseTemplateId;
  icon: string;
  title: string;
  description: string;
  build: () => DatabaseData;
}

type Opt = [id: string, name: string, color: OptionColor];
const sel = (id: string, name: string, options: Opt[], multi = false): Property => ({
  id,
  name,
  type: multi ? "multiSelect" : "select",
  options: options.map(([oid, oname, color]) => ({ id: oid, name: oname, color })),
});
const prop = (id: string, name: string, type: Property["type"], extra: Partial<Property> = {}): Property => ({ id, name, type, ...extra });
const view = (id: string, name: string, type: View["type"], extra: Partial<View> = {}): View => ({ id, name, type, filters: [], sorts: [], hidden: [], ...extra });
const rows = (cells: Row["cells"][]): Row[] => cells.map((c, i) => ({ id: ulid(), order: i + 1, cells: c }));
/** "YYYY-MM-DD", `days` from today in the viewer's calendar, so sample schedules start near now. */
const fromToday = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

interface Strings {
  table: string;
  board: string;
  gallery: string;
  mechanics: { title: string; description: string; name: string; status: string; statuses: [string, string, string, string]; complexity: string; levels: [string, string, string]; input: string; owner: string; notes: string; samples: [string, string, string]; sampleInputs: [string, string, string] };
  scope: { title: string; description: string; name: string; priority: string; priorities: [string, string, string, string]; status: string; statuses: [string, string, string, string]; estimate: string; owner: string; milestone: string; milestones: [string, string, string, string]; byStatus: string; samples: [string, string, string, string] };
  story: { title: string; description: string; name: string; act: string; acts: [string, string, string]; characters: string; location: string; purpose: string; samples: [string, string, string]; purposes: [string, string, string] };
  playtests: { title: string; description: string; name: string; date: string; build: string; tester: string; fun: string; issue: string; fixed: string; open: string; samples: [string, string]; issues: [string, string] };
  balance: { title: string; description: string; name: string; cost: string; damage: string; health: string; speed: string; dps: string; value: string; samples: [string, string, string] };
  moodboard: { title: string; description: string; name: string; image: string; tags: string; tagNames: [string, string, string, string, string]; notes: string; samples: [string, string, string] };
  schedule: { title: string; description: string; name: string; start: string; end: string; status: string; statuses: [string, string, string]; owner: string; timeline: string; calendar: string; samples: [string, string, string, string] };
}

const en: Strings = {
  table: "Table",
  board: "Board",
  gallery: "Gallery",
  mechanics: {
    title: "Mechanics",
    description: "Every mechanic with its status, input and complexity, as a table and a board.",
    name: "Mechanic",
    status: "Status",
    statuses: ["Idea", "Prototype", "Playtested", "Final"],
    complexity: "Complexity",
    levels: ["Low", "Medium", "High"],
    input: "Input",
    owner: "Owner",
    notes: "Notes",
    samples: ["Dash", "Double jump", "Wall grab"],
    sampleInputs: ["Shift", "Space in the air", "Hold toward the wall"],
  },
  scope: {
    title: "Scope tracker",
    description: "Features by priority (MoSCoW), status, estimate and milestone.",
    name: "Feature",
    priority: "Priority",
    priorities: ["Must", "Should", "Could", "Won't"],
    status: "Status",
    statuses: ["To do", "In progress", "Done", "Cut"],
    estimate: "Estimate (days)",
    owner: "Owner",
    milestone: "Milestone",
    milestones: ["Prototype", "Vertical slice", "Alpha", "Beta"],
    byStatus: "By status",
    samples: ["Core movement", "Save system", "Photo mode", "Online co-op"],
  },
  story: {
    title: "Story beats",
    description: "Beats on a board by act, with characters, location and purpose.",
    name: "Beat",
    act: "Act",
    acts: ["Act 1", "Act 2", "Act 3"],
    characters: "Characters",
    location: "Location",
    purpose: "Purpose",
    samples: ["The call", "Point of no return", "Final choice"],
    purposes: ["Hook the player", "Raise the stakes", "Pay off the theme"],
  },
  playtests: {
    title: "Playtest log",
    description: "One row per session: build, tester, fun score and the biggest issue.",
    name: "Session",
    date: "Date",
    build: "Build",
    tester: "Tester",
    fun: "Fun (1–5)",
    issue: "Biggest issue",
    fixed: "Fixed",
    open: "Open issues",
    samples: ["Session 1", "Session 2"],
    issues: ["Didn't find the dash", "Boss 2 too long"],
  },
  balance: {
    title: "Balance table",
    description: "Units with cost and stats; DPS and value are formulas.",
    name: "Unit",
    cost: "Cost",
    damage: "Damage",
    health: "Health",
    speed: "Attacks per second",
    dps: "DPS",
    value: "Value per cost",
    samples: ["Archer", "Knight", "Catapult"],
  },
  schedule: {
    title: "Production schedule",
    description: "Milestones and tasks with start and end dates, as a timeline and a calendar.",
    name: "Milestone",
    start: "Start",
    end: "End",
    status: "Status",
    statuses: ["Planned", "In progress", "Done"],
    owner: "Owner",
    timeline: "Timeline",
    calendar: "Calendar",
    samples: ["Prototype", "Vertical slice", "Playtest #1", "Alpha"],
  },
  moodboard: {
    title: "Mood board",
    description: "Visual references as a gallery, with tags and notes.",
    name: "Reference",
    image: "Image",
    tags: "Tags",
    tagNames: ["Color", "Lighting", "Character", "Environment", "UI"],
    notes: "Notes",
    samples: ["Warm dusk light", "Chunky silhouettes", "Hand-drawn UI"],
  },
};

const tr: Strings = {
  table: "Tablo",
  board: "Pano",
  gallery: "Galeri",
  mechanics: {
    title: "Mekanikler",
    description: "Her mekanik; durumu, girdisi ve karmaşıklığıyla, tablo ve pano olarak.",
    name: "Mekanik",
    status: "Durum",
    statuses: ["Fikir", "Prototip", "Test edildi", "Son hâli"],
    complexity: "Karmaşıklık",
    levels: ["Düşük", "Orta", "Yüksek"],
    input: "Girdi",
    owner: "Sorumlu",
    notes: "Notlar",
    samples: ["Atılma", "Çift zıplama", "Duvara tutunma"],
    sampleInputs: ["Shift", "Havada boşluk", "Duvara doğru basılı tut"],
  },
  scope: {
    title: "Kapsam takibi",
    description: "Özellikler; önceliğe (MoSCoW), duruma, tahmine ve kilometre taşına göre.",
    name: "Özellik",
    priority: "Öncelik",
    priorities: ["Şart", "Olmalı", "Olabilir", "Olmayacak"],
    status: "Durum",
    statuses: ["Yapılacak", "Sürüyor", "Bitti", "Çıkarıldı"],
    estimate: "Tahmin (gün)",
    owner: "Sorumlu",
    milestone: "Kilometre taşı",
    milestones: ["Prototip", "Dikey kesit", "Alfa", "Beta"],
    byStatus: "Duruma göre",
    samples: ["Temel hareket", "Kayıt sistemi", "Fotoğraf modu", "Çevrim içi ortak oyun"],
  },
  story: {
    title: "Hikâye vuruşları",
    description: "Perdelere göre panoda vuruşlar; karakterler, mekân ve amaç.",
    name: "Vuruş",
    act: "Perde",
    acts: ["1. perde", "2. perde", "3. perde"],
    characters: "Karakterler",
    location: "Mekân",
    purpose: "Amaç",
    samples: ["Çağrı", "Dönüşü olmayan nokta", "Son seçim"],
    purposes: ["Oyuncuyu yakala", "Riski artır", "Temayı sonuca bağla"],
  },
  playtests: {
    title: "Oyun testi kaydı",
    description: "Her oturum bir satır: sürüm, test eden, eğlence puanı ve en büyük sorun.",
    name: "Oturum",
    date: "Tarih",
    build: "Sürüm",
    tester: "Test eden",
    fun: "Eğlence (1–5)",
    issue: "En büyük sorun",
    fixed: "Düzeltildi",
    open: "Açık sorunlar",
    samples: ["1. oturum", "2. oturum"],
    issues: ["Atılmayı bulamadı", "2. boss çok uzun"],
  },
  balance: {
    title: "Denge tablosu",
    description: "Birimler, maliyet ve değerler; DPS ve verim formülle hesaplanır.",
    name: "Birim",
    cost: "Maliyet",
    damage: "Hasar",
    health: "Can",
    speed: "Saniyede saldırı",
    dps: "DPS",
    value: "Maliyet başına değer",
    samples: ["Okçu", "Şövalye", "Mancınık"],
  },
  schedule: {
    title: "Üretim takvimi",
    description: "Başlangıç ve bitiş tarihli kilometre taşları ve işler; zaman çizelgesi ve takvim olarak.",
    name: "Kilometre taşı",
    start: "Başlangıç",
    end: "Bitiş",
    status: "Durum",
    statuses: ["Planlandı", "Sürüyor", "Bitti"],
    owner: "Sorumlu",
    timeline: "Zaman çizelgesi",
    calendar: "Takvim",
    samples: ["Prototip", "Dikey kesit", "Oyun testi #1", "Alfa"],
  },
  moodboard: {
    title: "Moodboard",
    description: "Görsel referanslar galeri olarak; etiketler ve notlarla.",
    name: "Referans",
    image: "Görsel",
    tags: "Etiketler",
    tagNames: ["Renk", "Işık", "Karakter", "Ortam", "Arayüz"],
    notes: "Notlar",
    samples: ["Sıcak gün batımı ışığı", "Tombul silüetler", "Elle çizilmiş arayüz"],
  },
};

const de: Strings = {
  table: "Tabelle",
  board: "Board",
  gallery: "Galerie",
  mechanics: {
    title: "Mechaniken",
    description: "Jede Mechanik mit Status, Eingabe und Komplexität, als Tabelle und Board.",
    name: "Mechanik",
    status: "Status",
    statuses: ["Idee", "Prototyp", "Getestet", "Final"],
    complexity: "Komplexität",
    levels: ["Niedrig", "Mittel", "Hoch"],
    input: "Eingabe",
    owner: "Zuständig",
    notes: "Notizen",
    samples: ["Dash", "Doppelsprung", "Wandgriff"],
    sampleInputs: ["Umschalt", "Leertaste in der Luft", "Zur Wand halten"],
  },
  scope: {
    title: "Scope-Tracker",
    description: "Features nach Priorität (MoSCoW), Status, Schätzung und Meilenstein.",
    name: "Feature",
    priority: "Priorität",
    priorities: ["Muss", "Sollte", "Könnte", "Nicht jetzt"],
    status: "Status",
    statuses: ["Offen", "In Arbeit", "Fertig", "Gestrichen"],
    estimate: "Schätzung (Tage)",
    owner: "Zuständig",
    milestone: "Meilenstein",
    milestones: ["Prototyp", "Vertical Slice", "Alpha", "Beta"],
    byStatus: "Nach Status",
    samples: ["Grundbewegung", "Speichersystem", "Fotomodus", "Online-Koop"],
  },
  story: {
    title: "Story-Beats",
    description: "Beats auf einem Board nach Akt, mit Figuren, Ort und Zweck.",
    name: "Beat",
    act: "Akt",
    acts: ["Akt 1", "Akt 2", "Akt 3"],
    characters: "Figuren",
    location: "Ort",
    purpose: "Zweck",
    samples: ["Der Ruf", "Kein Zurück", "Letzte Entscheidung"],
    purposes: ["Spieler fesseln", "Einsatz erhöhen", "Thema einlösen"],
  },
  playtests: {
    title: "Playtest-Protokoll",
    description: "Eine Zeile pro Session: Build, Tester, Spaß-Wertung und größtes Problem.",
    name: "Session",
    date: "Datum",
    build: "Build",
    tester: "Tester",
    fun: "Spaß (1–5)",
    issue: "Größtes Problem",
    fixed: "Behoben",
    open: "Offene Probleme",
    samples: ["Session 1", "Session 2"],
    issues: ["Dash nicht gefunden", "Boss 2 zu lang"],
  },
  balance: {
    title: "Balancing-Tabelle",
    description: "Einheiten mit Kosten und Werten; DPS und Effizienz sind Formeln.",
    name: "Einheit",
    cost: "Kosten",
    damage: "Schaden",
    health: "Leben",
    speed: "Angriffe pro Sekunde",
    dps: "DPS",
    value: "Wert pro Kosten",
    samples: ["Bogenschütze", "Ritter", "Katapult"],
  },
  schedule: {
    title: "Produktionsplan",
    description: "Meilensteine und Aufgaben mit Start- und Enddatum, als Zeitleiste und Kalender.",
    name: "Meilenstein",
    start: "Beginn",
    end: "Ende",
    status: "Status",
    statuses: ["Geplant", "In Arbeit", "Fertig"],
    owner: "Verantwortlich",
    timeline: "Zeitleiste",
    calendar: "Kalender",
    samples: ["Prototyp", "Vertical Slice", "Playtest #1", "Alpha"],
  },
  moodboard: {
    title: "Moodboard",
    description: "Visuelle Referenzen als Galerie, mit Tags und Notizen.",
    name: "Referenz",
    image: "Bild",
    tags: "Tags",
    tagNames: ["Farbe", "Licht", "Figur", "Umgebung", "UI"],
    notes: "Notizen",
    samples: ["Warmes Abendlicht", "Kräftige Silhouetten", "Handgezeichnete UI"],
  },
};

const sets: Record<string, Strings> = { en, tr, de };

export function getDatabaseTemplates(locale: string): DatabaseTemplate[] {
  const s = sets[locale] ?? en;
  const m = s.mechanics;
  const sc = s.scope;
  const st = s.story;
  const pt = s.playtests;
  const b = s.balance;
  const sch = s.schedule;
  const mb = s.moodboard;
  return [
    {
      id: "mechanics",
      icon: "⚙️",
      title: m.title,
      description: m.description,
      build: () => ({
        properties: [
          prop("title", m.name, "title"),
          sel("status", m.status, [["idea", m.statuses[0], "gray"], ["proto", m.statuses[1], "blue"], ["tested", m.statuses[2], "amber"], ["final", m.statuses[3], "moss"]]),
          sel("complexity", m.complexity, [["low", m.levels[0], "teal"], ["mid", m.levels[1], "amber"], ["high", m.levels[2], "red"]]),
          prop("input", m.input, "text"),
          prop("owner", m.owner, "person"),
          prop("notes", m.notes, "text"),
        ],
        views: [view("board", s.board, "board", { groupBy: "status" }), view("table", s.table, "table")],
        rows: rows([
          { title: m.samples[0], status: "final", complexity: "low", input: m.sampleInputs[0] },
          { title: m.samples[1], status: "tested", complexity: "mid", input: m.sampleInputs[1] },
          { title: m.samples[2], status: "idea", complexity: "high", input: m.sampleInputs[2] },
        ]),
      }),
    },
    {
      id: "scope",
      icon: "🎯",
      title: sc.title,
      description: sc.description,
      build: () => ({
        properties: [
          prop("title", sc.name, "title"),
          sel("priority", sc.priority, [["must", sc.priorities[0], "red"], ["should", sc.priorities[1], "amber"], ["could", sc.priorities[2], "blue"], ["wont", sc.priorities[3], "gray"]]),
          sel("status", sc.status, [["todo", sc.statuses[0], "gray"], ["doing", sc.statuses[1], "blue"], ["done", sc.statuses[2], "moss"], ["cut", sc.statuses[3], "red"]]),
          prop("estimate", sc.estimate, "number"),
          prop("owner", sc.owner, "person"),
          sel("milestone", sc.milestone, [["proto", sc.milestones[0], "gray"], ["slice", sc.milestones[1], "teal"], ["alpha", sc.milestones[2], "blue"], ["beta", sc.milestones[3], "purple"]]),
        ],
        views: [
          view("board", s.board, "board", { groupBy: "priority" }),
          view("status", sc.byStatus, "board", { groupBy: "status" }),
          view("table", s.table, "table", { sorts: [{ propertyId: "priority", dir: "asc" }] }),
        ],
        rows: rows([
          { title: sc.samples[0], priority: "must", status: "doing", estimate: 5, milestone: "proto" },
          { title: sc.samples[1], priority: "should", status: "todo", estimate: 3, milestone: "slice" },
          { title: sc.samples[2], priority: "could", status: "todo", estimate: 2, milestone: "beta" },
          { title: sc.samples[3], priority: "wont", status: "cut", milestone: "beta" },
        ]),
      }),
    },
    {
      id: "story-beats",
      icon: "📜",
      title: st.title,
      description: st.description,
      build: () => ({
        properties: [
          prop("title", st.name, "title"),
          sel("act", st.act, [["a1", st.acts[0], "blue"], ["a2", st.acts[1], "amber"], ["a3", st.acts[2], "red"]]),
          sel("characters", st.characters, [], true),
          prop("location", st.location, "text"),
          prop("purpose", st.purpose, "text"),
        ],
        views: [view("board", s.board, "board", { groupBy: "act" }), view("table", s.table, "table")],
        rows: rows([
          { title: st.samples[0], act: "a1", purpose: st.purposes[0] },
          { title: st.samples[1], act: "a2", purpose: st.purposes[1] },
          { title: st.samples[2], act: "a3", purpose: st.purposes[2] },
        ]),
      }),
    },
    {
      id: "playtests",
      icon: "🎮",
      title: pt.title,
      description: pt.description,
      build: () => ({
        properties: [
          prop("title", pt.name, "title"),
          prop("date", pt.date, "date"),
          prop("build", pt.build, "text"),
          prop("tester", pt.tester, "person"),
          prop("fun", pt.fun, "number"),
          prop("issue", pt.issue, "text"),
          prop("fixed", pt.fixed, "checkbox"),
        ],
        views: [
          view("table", s.table, "table", { sorts: [{ propertyId: "date", dir: "desc" }] }),
          view("open", pt.open, "table", { filters: [{ propertyId: "fixed", op: "unchecked" }], hidden: ["fixed"] }),
        ],
        rows: rows([
          { title: pt.samples[0], date: "2026-01-10", build: "0.1.0", fun: 3, issue: pt.issues[0], fixed: true },
          { title: pt.samples[1], date: "2026-01-17", build: "0.1.1", fun: 4, issue: pt.issues[1] },
        ]),
      }),
    },
    {
      id: "schedule",
      icon: "🗓️",
      title: sch.title,
      description: sch.description,
      build: () => ({
        properties: [
          prop("title", sch.name, "title"),
          prop("start", sch.start, "date"),
          prop("end", sch.end, "date"),
          sel("status", sch.status, [["planned", sch.statuses[0], "gray"], ["doing", sch.statuses[1], "blue"], ["done", sch.statuses[2], "moss"]]),
          prop("owner", sch.owner, "person"),
        ],
        views: [
          view("timeline", sch.timeline, "timeline", { dateProperty: "start", endProperty: "end", sorts: [{ propertyId: "start", dir: "asc" }] }),
          view("calendar", sch.calendar, "calendar", { dateProperty: "end" }),
          view("table", s.table, "table", { sorts: [{ propertyId: "start", dir: "asc" }] }),
        ],
        rows: rows([
          { title: sch.samples[0], start: fromToday(-7), end: fromToday(7), status: "doing" },
          { title: sch.samples[1], start: fromToday(8), end: fromToday(35), status: "planned" },
          { title: sch.samples[2], start: fromToday(21), end: fromToday(21), status: "planned" },
          { title: sch.samples[3], start: fromToday(36), end: fromToday(63), status: "planned" },
        ]),
      }),
    },
    {
      id: "balance",
      icon: "⚖️",
      title: b.title,
      description: b.description,
      build: () => ({
        properties: [
          prop("title", b.name, "title"),
          prop("cost", b.cost, "number"),
          prop("damage", b.damage, "number"),
          prop("health", b.health, "number"),
          prop("speed", b.speed, "number"),
          prop("dps", b.dps, "formula", { formula: `{${b.damage}} * {${b.speed}}` }),
          prop("value", b.value, "formula", { formula: `round(({${b.dps}} + {${b.health}} / 10) / max({${b.cost}}, 1), 2)` }),
        ],
        views: [view("table", s.table, "table", { sorts: [{ propertyId: "value", dir: "desc" }] })],
        rows: rows([
          { title: b.samples[0], cost: 50, damage: 8, health: 60, speed: 1.2 },
          { title: b.samples[1], cost: 90, damage: 14, health: 160, speed: 0.8 },
          { title: b.samples[2], cost: 150, damage: 60, health: 90, speed: 0.25 },
        ]),
      }),
    },
    {
      id: "moodboard",
      icon: "🖼️",
      title: mb.title,
      description: mb.description,
      build: () => ({
        properties: [
          prop("title", mb.name, "title"),
          prop("image", mb.image, "url"),
          sel("tags", mb.tags, mb.tagNames.map((n, i) => [`t${i}`, n, (["amber", "brown", "moss", "teal", "blue"] as const)[i]] as Opt), true),
          prop("notes", mb.notes, "text"),
        ],
        views: [view("gallery", s.gallery, "gallery", { coverProperty: "image" }), view("table", s.table, "table")],
        rows: rows([
          { title: mb.samples[0], tags: ["t0", "t1"] },
          { title: mb.samples[1], tags: ["t2"] },
          { title: mb.samples[2], tags: ["t4"] },
        ]),
      }),
    },
  ];
}
