import type { GameTemplateSet } from "./types";

export const de: GameTemplateSet = {
  "one-page-gdd": {
    title: "One-Page-GDD",
    description: "Das ganze Spiel auf einer Seite: Pitch, Design-Pillars, Core Loop, Umfang.",
    markdown: `:::callout idea
Halte diese Seite so kurz, dass man sie in zwei Minuten liest. Verlinke Details auf eigene Seiten, sobald sie wachsen.
:::

## Pitch

*Ein Satz: Wen spielt man, was tut man, warum macht es Spaß?*

## Design-Pillars

1. **Erster Pillar:** was jedes Feature unterstützen muss
2. **Zweiter Pillar:**
3. **Dritter Pillar:**

## Core Loop

1. Erkunden
2. Sammeln
3. Verbessern
4. Mit neuer Herausforderung wiederholen

## Zielgruppe und Plattform

| | |
| --- | --- |
| Genre | |
| Plattform | |
| Zielgruppe | |
| Sitzungsdauer | |
| Vergleichbare Spiele | |

## Kernfeatures

- [ ] Erstes Feature
- [ ] Zweites Feature
- [ ] Drittes Feature

## Umfang und Risiken

:::callout warning
Größtes Risiko: *Was könnte verhindern, dass dieses Spiel fertig wird?*
:::
`,
  },
  "full-gdd": {
    title: "Game-Design-Dokument",
    description: "Vollständige GDD-Struktur: Vision, Gameplay, Welt, Inhalte, Produktion.",
    markdown: `## 1. Vision

### High Concept

### Design-Pillars

1.
2.
3.

### Zielgruppe und Plattformen

## 2. Gameplay

### Core Loop

### Steuerung

| Aktion | Tastatur / Maus | Gamepad |
| --- | --- | --- |
| Bewegen | WASD | Linker Stick |
| Interagieren | E | A |

### Mechaniken

*Systeme auflisten; jedes komplexe System bekommt eine eigene Mechanik-Spezifikation.*

### Progression

### Scheitern und Schwierigkeit

## 3. Welt und Story

### Setting

### Hauptfiguren

### Erzählstruktur

## 4. Inhalte

### Level

### Gegner und Hindernisse

### Gegenstände

## 5. Grafik und Audio

### Visueller Stil

### Audio-Richtung

## 6. Benutzeroberfläche

### HUD

### Menüs

## 7. Produktion

### Meilensteine

| Meilenstein | Datum | Ziel |
| --- | --- | --- |
| Prototyp | | Core Loop spielbar |
| Vertical Slice | | Ein poliertes Level |
| Alpha | | Alle Features drin |
| Beta | | Inhalte vollständig |

### Team und Rollen

:::toggle Offene Fragen
- Erste Frage
:::
`,
  },
  "vertical-slice": {
    title: "Vertical-Slice-Plan",
    description: "Umfang eines polierten, repräsentativen Ausschnitts des Spiels.",
    markdown: `:::callout idea
Ein Vertical Slice beweist die finale Qualität an einem kleinen Stück des Spiels: ein Level, jede Ebene fertig.
:::

## Ziel

*Welche Frage beantwortet dieser Slice? (z. B. „Macht Stealth in voller Qualität Spaß?“)*

## Enthalten

- [ ] Level / Bereich:
- [ ] Mechaniken:
- [ ] Gegner:
- [ ] UI-Screens:
- [ ] Audio:

## Nicht enthalten

-

## Qualitätsanspruch

| Ebene | Ziel |
| --- | --- |
| Gameplay | Finales Spielgefühl, getunt |
| Grafik | Final oder nahezu final |
| Audio | Finale SFX, Platzhalter-Musik erlaubt |
| UI | Finales Layout |

## Erfolgskriterien

1. Tester schaffen den Slice ohne Hilfe
2.
3.

## Zeitplan und Verantwortliche

| Aufgabe | Verantwortlich | Fällig |
| --- | --- | --- |
| | | |

:::callout warning
Streichliste: Was fliegt zuerst raus, wenn der Slice zu spät kommt?
:::
`,
  },
  "pitch-deck": {
    title: "Pitch-Deck-Gliederung",
    description: "Folie für Folie für Pitches bei Publishern, Jurys oder im Kurs.",
    markdown: `## Folie 1: Titel

Spielname, Hook in einem Satz, Key Art.

## Folie 2: Der Hook

*Warum sollte es Spieler interessieren? Ein Satz, ein Bild.*

## Folie 3: Gameplay

Core Loop in drei Schritten, dazu ein GIF oder kurzes Video.

## Folie 4: Design-Pillars

1.
2.
3.

## Folie 5: Zielgruppe und Markt

| | |
| --- | --- |
| Zielgruppe | |
| Vergleichbare Spiele | |
| Plattformen | |
| Preis | |

## Folie 6: Was uns unterscheidet

## Folie 7: Team

## Folie 8: Stand und Roadmap

- [ ] Prototyp
- [ ] Vertical Slice
- [ ] Release

## Folie 9: Unsere Bitte

*Was braucht ihr: Finanzierung, Publisher, Feedback, eine Note?*

:::callout idea
Probt den Pitch in unter fünf Minuten. Jede Folie muss in fünf Sekunden erfassbar sein.
:::
`,
  },
  "level-design": {
    title: "Level-Design-Dokument",
    description: "Layout, Spannungsbogen, Begegnungen und Metriken eines Levels.",
    markdown: `## Überblick

| | |
| --- | --- |
| Level | |
| Position im Spiel | z. B. 3 von 10 |
| Spielzeit | |
| Neue Mechanik | |
| Stimmung | |

## Ziel des Levels

*Was lernt, fühlt oder erreicht der Spieler hier?*

## Ablauf und Spannungsbogen

1. **Einstieg:** sicherer Raum, neue Idee vorstellen
2. **Üben:** Mechanik mit wenig Risiko anwenden
3. **Wendung:** Mechanik mit Bekanntem kombinieren
4. **Höhepunkt:**
5. **Belohnung und Ausgang:**

## Karte

![Kartenskizze](assets/level-map.png)

## Begegnungen

| # | Ort | Gegner | Zweck |
| --- | --- | --- | --- |
| 1 | | | |

## Metriken

| Metrik | Wert |
| --- | --- |
| Sprunghöhe | |
| Gangbreite | |
| Deckungsabstand | |

## Geheimnisse und optionale Wege

:::callout warning
Checkpoints: Markiere Respawn-Punkte; kein Abschnitt sollte mehr als 2 Minuten Wiederholung kosten.
:::
`,
  },
  "mechanic-spec": {
    title: "Mechanik-Spezifikation",
    description: "Regeln, Eingaben, Sonderfälle und Tuning-Werte einer Mechanik.",
    markdown: `## Zusammenfassung

*Ein Satz: Was tut der Spieler und warum?*

## Unterstützter Pillar

## Regeln

1.
2.
3.

## Eingaben und Feedback

| Eingabe | Ergebnis | Feedback (visuell / Audio / Haptik) |
| --- | --- | --- |
| | | |

## Zustände

\`\`\`
Bereit -> Aufladen -> Auslösen -> Abklingzeit -> Bereit
\`\`\`

## Tuning-Werte

| Parameter | Wert | Notiz |
| --- | --- | --- |
| Abklingzeit (Cooldown) | 1,5 s | |
| Schaden | 10 | |

## Sonderfälle

- Was passiert, wenn der Spieler in der Luft ist?
- Was passiert, wenn zwei Spieler es gleichzeitig auslösen?

## Wechselwirkungen mit anderen Systemen

## Offene Fragen

- [ ]
`,
  },
  "economy-balance": {
    title: "Ökonomie- und Balancing-Tabelle",
    description: "Währungen, Quellen und Senken, Preise und Progressionskurven.",
    markdown: `## Währungen

| Währung | Verdient durch | Ausgegeben für | Obergrenze |
| --- | --- | --- | --- |
| Gold | Gegner, Truhen | Shop, Upgrades | |

## Quellen und Senken (Sources & Sinks)

:::callout idea
Jede Quelle braucht eine Senke. Wenn Spieler nur verdienen, entwertet Inflation jede Entscheidung.
:::

## Progressionskurve

Erfahrung pro Stufe: \`xp(stufe) = 100 * 1.15 ^ (stufe - 1)\`

| Stufe | XP bis zur nächsten | Freischaltungen |
| --- | --- | --- |
| 1 | 100 | |
| 2 | 115 | |
| 3 | 132 | |

## Preise

| Gegenstand | Preis | Zeit bis erschwinglich |
| --- | --- | --- |
| | | |

## Schaden und Lebenspunkte

| Einheit | LP | Schaden | Treffer bis Spieler-Tod |
| --- | --- | --- | --- |
| | | | |

:::callout warning
Ziel aufschreiben: „Neue Spieler kaufen ihr erstes Upgrade nach etwa 10 Minuten.“
:::
`,
  },
  "ui-ux-flow": {
    title: "UI/UX-Flow",
    description: "Screens, Navigation, HUD und Anforderungen an Barrierefreiheit.",
    markdown: `## Screen-Liste

| Screen | Zweck | Erreicht von |
| --- | --- | --- |
| Titel | | Start |
| Hauptmenü | | Titel |
| Einstellungen | | Hauptmenü, Pause |
| HUD | | Gameplay |
| Pause | | Gameplay |

## Navigationsfluss

\`\`\`
Start -> Titel -> Hauptmenü -> Gameplay <-> Pause -> Einstellungen
\`\`\`

## HUD

*Was muss der Spieler immer sehen? Was erscheint nur bei Bedarf?*

- Lebenspunkte
- Ziel
-

## Eingabe

- [ ] Vollständig mit Gamepad spielbar
- [ ] Vollständig nur mit Tastatur spielbar
- [ ] Tasten frei belegbar

## Barrierefreiheit

- [ ] Untertitel mit Größen- und Hintergrundoptionen
- [ ] Farbenblind-taugliche Palette (Information nie nur über Farbe)
- [ ] Textskalierung
- [ ] Option für weniger Bewegung / Screenshake
- [ ] Alternativen zum Gedrückthalten

## Wireframes

![Wireframe](assets/wireframe.png)
`,
  },
  "narrative-bible": {
    title: "Story-Bible",
    description: "Welt, Lore, Erzählstruktur, Figuren und Tonalität.",
    markdown: `## Prämisse

*Ein Absatz: die Welt, der Konflikt, das Ziel der Hauptfigur.*

## Thema und Tonalität

## Welt

### Geschichte

### Orte

### Fraktionen

| Fraktion | Ziel | Verhältnis zum Spieler |
| --- | --- | --- |
| | | |

## Erzählstruktur

| Akt | Ereignisse | Bezug zum Gameplay |
| --- | --- | --- |
| I. Exposition | | |
| II. Konfrontation | | |
| III. Auflösung | | |

## Figuren

*Lege für jede Hauptfigur ein Charakterblatt an und verlinke es hier.*

## Erzählmittel

- [ ] Zwischensequenzen
- [ ] Dialoge im Spiel
- [ ] Environmental Storytelling
- [ ] Sammelbare Lore

## Kanon-Regeln

:::callout warning
Was in dieser Welt immer gilt. Neue Inhalte daran prüfen.
:::

1.
`,
  },
  "character-sheet": {
    title: "Charakterblatt",
    description: "Rolle, Persönlichkeit, Fähigkeiten, Aussehen und Stimme einer Figur.",
    markdown: `![Konzeptzeichnung](assets/character.png)

## Grunddaten

| | |
| --- | --- |
| Name | |
| Rolle | Protagonist / Verbündeter / Gegner / NPC |
| Alter | |
| Erster Auftritt | |

## Persönlichkeit

*Drei Adjektive, dann ein Satz dazu, was die Figur will und wovor sie Angst hat.*

## Hintergrund

## Fähigkeiten und Werte

| Wert | Größe |
| --- | --- |
| Lebenspunkte | |
| Tempo | |
| Spezialfähigkeit | |

## Beziehungen

| Figur | Beziehung |
| --- | --- |
| | |

## Aussehen und Stimme

- Silhouette:
- Farbpalette:
- Stimme / Sprechweise:

## Entwicklung (Character Arc)

*Wie verändert sich die Figur vom Anfang bis zum Ende?*
`,
  },
  "art-bible": {
    title: "Art Bible",
    description: "Visueller Stil, Paletten, Referenzen und Asset-Regeln.",
    markdown: `## Visuelle Pillars

1.
2.
3.

## Moodboard

![Referenz](assets/reference-1.png)

## Farbe

| Verwendung | Farben | Notiz |
| --- | --- | --- |
| Spieler | | Muss sich von jedem Hintergrund abheben |
| Gegner | | |
| Interaktive Objekte | | |

## Formen und Silhouetten

*Freundlich = rund, Gefahr = spitz? Definiert eure Formensprache.*

## Licht und Kamera

## Figuren

## Umgebungen

## UI-Stil

## Asset-Regeln

| Asset | Format | Größe / Polygonbudget | Benennung |
| --- | --- | --- | --- |
| Texturen | PNG | max. 2048² | T_Name_Typ |
| Figuren | FBX | | SK_Name |

:::callout warning
Dateien über 1 MB gehören nicht in diesen Arbeitsbereich; verlinkt stattdessen das Art-Repository oder Laufwerk.
:::
`,
  },
  "technical-design": {
    title: "Technisches Design-Dokument",
    description: "Engine, Architektur, Systeme, Tools und technische Risiken.",
    markdown: `## Plattform und Engine

| | |
| --- | --- |
| Engine | |
| Sprache | |
| Zielplattformen | |
| Mindestanforderungen | |
| Ziel-Framerate | |

## Architekturüberblick

\`\`\`
Eingabe -> Spielzustand -> Systeme (KI, Physik, Kampf) -> Rendering / Audio
\`\`\`

## Systeme

| System | Verantwortlich | Status | Notiz |
| --- | --- | --- | --- |
| Speichern / Laden | | | |
| KI | | | |

## Daten- und Content-Pipeline

## Tools

## Performance-Budgets

| Budget | Ziel |
| --- | --- |
| Frame-Zeit | 16,6 ms |
| Speicher | |
| Ladezeit | |

## Technische Risiken

- [ ] Risiko:
  - Gegenmaßnahme:

## Coding-Standards und Versionsverwaltung

:::callout idea
Haltet Branch-Namen, Review-Regeln und den Build-Prozess fest, damit neue Teammitglieder am ersten Tag loslegen können.
:::
`,
  },
  "playtest-report": {
    title: "Playtest-Bericht",
    description: "Sitzungsdaten, Beobachtungen, Erkenntnisse und Maßnahmen.",
    markdown: `## Sitzung

| | |
| --- | --- |
| Datum | |
| Build | |
| Tester | |
| Moderation | |
| Dauer | |

## Ziele

*Was wollten wir herausfinden?*

1.

## Beobachtungen

| Zeit | Was passierte | Schwere |
| --- | --- | --- |
| | | Niedrig / Mittel / Hoch |

## Zitate

> „…“

## Erkenntnisse

:::callout warning
Erkenntnisse als Probleme formulieren, nicht als Lösungen: „Spieler übersehen den Ausgang“ statt „Pfeil hinzufügen“.
:::

1.

## Maßnahmen

- [ ] Maßnahme, verantwortlich, fällig

## Messwerte

| Messwert | Ergebnis |
| --- | --- |
| Abschlussquote | |
| Durchschnittliche Zeit | |
| Tode pro Level | |
`,
  },
  "post-mortem": {
    title: "Post-Mortem",
    description: "Was lief gut, was lief schlecht, was ändern wir.",
    markdown: `## Projektzusammenfassung

| | |
| --- | --- |
| Projekt | |
| Dauer | |
| Teamgröße | |
| Ergebnis | |

## Ziele und Ergebnisse

| Ziel | Ergebnis |
| --- | --- |
| | |

## Was gut lief

1.
2.
3.

## Was schlecht lief

1.
2.
3.

## Umfang

*Was haben wir wann gestrichen, und war das richtig?*

## Prozess und Kommunikation

## Lehren für das nächste Mal

- [ ]
- [ ]

:::callout idea
Ohne Schuldzuweisung schreiben: Entscheidungen und ihren Kontext beschreiben, nicht Personen.
:::
`,
  },
};
