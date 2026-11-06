import type { GeneralTemplateId, TemplateContent } from "./types";

/**
 * General-purpose page templates: content creation (video scripts, blog posts, newsletters) and
 * everyday work (meetings, projects, weekly plans). Written per language, not translated word for
 * word; the game design templates live in en.ts / tr.ts / de.ts.
 */

type GeneralSet = Record<GeneralTemplateId, TemplateContent>;

export const generalEn: GeneralSet = {
  "video-script": {
    title: "Video script",
    description: "A YouTube video from hook to call to action, with shots and notes.",
    markdown: `| | |
| --- | --- |
| Working title | |
| Target length | 8–12 min |
| Publish date | |
| Status | Idea / Script / Filming / Editing / Published |

## Promise

*One sentence: what will the viewer know or be able to do after watching?*

## Hook (first 15 seconds)

> Say the most interesting thing first.

## Intro

- Who this is for
- What they'll get

## Main part

### 1. First point

Script:

Visuals / B-roll:

### 2. Second point

Script:

Visuals / B-roll:

### 3. Third point

Script:

Visuals / B-roll:

## Call to action

- [ ] Subscribe or follow
- [ ] Link in the description
- [ ] Next video to watch

## Thumbnail and title ideas

1.
2.
3.

:::toggle Description and tags
**Description:**

**Chapters:** 00:00 Intro

**Tags:**
:::
`,
  },
  "blog-post": {
    title: "Blog post",
    description: "An article with audience, outline, draft and a publishing checklist.",
    markdown: `| | |
| --- | --- |
| Audience | |
| Main keyword | |
| Publish date | |

:::callout idea
Write the outline first. A clear outline makes the draft twice as fast.
:::

## The one idea

*If readers remember one sentence, which is it?*

## Outline

1. Introduction: the problem
2. Point one
3. Point two
4. Conclusion: what to do next

## Draft

Start writing here.

## Before publishing

- [ ] Title under 60 characters
- [ ] Meta description
- [ ] Images with alt text
- [ ] Links checked
- [ ] Read aloud once
`,
  },
  newsletter: {
    title: "Newsletter",
    description: "One issue: subject line, the main story, short links and what's next.",
    markdown: `| | |
| --- | --- |
| Issue | #1 |
| Send date | |
| Subject line | |
| Preview text | |

## Hello

A short, personal opening.

## Main story

What happened, why it matters, what readers can do with it.

## Short links

- **Link one:** why it's worth a click
- **Link two:**
- **Link three:**

## Coming up

What's next, and how readers can reply.

- [ ] Proofread
- [ ] Send a test to yourself
- [ ] Schedule
`,
  },
  "meeting-notes": {
    title: "Meeting notes",
    description: "Agenda, notes, decisions and action items with owners.",
    markdown: `| | |
| --- | --- |
| Date | |
| Attendees | |
| Facilitator | |

## Agenda

1.
2.
3.

## Notes

-

## Decisions

:::callout success
Write each decision as one sentence anyone can understand later.
:::

-

## Action items

- [ ] Task, owner, due date
- [ ] Task, owner, due date
`,
  },
  "project-plan": {
    title: "Project plan",
    description: "Goal, scope, milestones, risks and who does what.",
    markdown: `## Goal

*What does success look like, and how will we measure it?*

## Scope

**In:**

-

**Out:**

-

## Milestones

| Milestone | Date | Owner | Status |
| --- | --- | --- | --- |
| Kickoff | | | Done |
| First draft | | | |
| Launch | | | |

## Risks

:::callout warning
List what could go wrong early, while it is still cheap to change course.
:::

| Risk | Likelihood | Plan |
| --- | --- | --- |
| | Low / Medium / High | |

## Team

- **Owner:**
- **Contributors:**

## Open questions

- [ ]
`,
  },
  "weekly-plan": {
    title: "Weekly plan",
    description: "Top priorities, day-by-day tasks and a short review at the end of the week.",
    markdown: `## This week's top three

1.
2.
3.

## Monday

- [ ]

## Tuesday

- [ ]

## Wednesday

- [ ]

## Thursday

- [ ]

## Friday

- [ ]

## Review

:::toggle How did it go?
**Done:**

**Not done, and why:**

**Next week:**
:::
`,
  },
};

export const generalTr: GeneralSet = {
  "video-script": {
    title: "Video senaryosu",
    description: "Kancadan harekete geçirici çağrıya bir YouTube videosu; çekim ve notlarla.",
    markdown: `| | |
| --- | --- |
| Çalışma başlığı | |
| Hedef süre | 8–12 dk |
| Yayın tarihi | |
| Durum | Fikir / Senaryo / Çekim / Kurgu / Yayında |

## Vaat

*Tek cümle: izleyici videoyu bitirdiğinde neyi bilecek ya da yapabilecek?*

## Kanca (ilk 15 saniye)

> En ilginç şeyi en başta söyle.

## Giriş

- Video kimin için
- İzleyici ne kazanacak

## Ana bölüm

### 1. Birinci konu

Metin:

Görüntü / ara çekimler:

### 2. İkinci konu

Metin:

Görüntü / ara çekimler:

### 3. Üçüncü konu

Metin:

Görüntü / ara çekimler:

## Harekete geçirici çağrı

- [ ] Abone ol ya da takip et
- [ ] Açıklamadaki bağlantı
- [ ] Sıradaki izlenecek video

## Küçük resim ve başlık fikirleri

1.
2.
3.

:::toggle Açıklama ve etiketler
**Açıklama:**

**Bölümler:** 00:00 Giriş

**Etiketler:**
:::
`,
  },
  "blog-post": {
    title: "Blog yazısı",
    description: "Hedef okur, taslak planı, metin ve yayın öncesi kontrol listesiyle bir yazı.",
    markdown: `| | |
| --- | --- |
| Hedef okur | |
| Ana anahtar kelime | |
| Yayın tarihi | |

:::callout idea
Önce taslak planını yaz. Net bir plan, yazmayı iki kat hızlandırır.
:::

## Tek fikir

*Okur tek bir cümle hatırlayacaksa hangisi olsun?*

## Plan

1. Giriş: sorun
2. Birinci nokta
3. İkinci nokta
4. Sonuç: okur şimdi ne yapmalı

## Metin

Buraya yazmaya başla.

## Yayından önce

- [ ] Başlık 60 karakterin altında
- [ ] Meta açıklama
- [ ] Görsellerin alternatif metni
- [ ] Bağlantılar kontrol edildi
- [ ] Bir kez sesli okundu
`,
  },
  newsletter: {
    title: "Bülten",
    description: "Bir sayı: konu satırı, ana haber, kısa bağlantılar ve sıradakiler.",
    markdown: `| | |
| --- | --- |
| Sayı | #1 |
| Gönderim tarihi | |
| Konu satırı | |
| Ön izleme metni | |

## Merhaba

Kısa, kişisel bir açılış.

## Ana haber

Ne oldu, neden önemli, okur bununla ne yapabilir.

## Kısa bağlantılar

- **Birinci bağlantı:** neden tıklamaya değer
- **İkinci bağlantı:**
- **Üçüncü bağlantı:**

## Sırada ne var

Sonraki adımlar ve okurların nasıl yanıt verebileceği.

- [ ] Son okuma yapıldı
- [ ] Kendine deneme gönderildi
- [ ] Zamanlandı
`,
  },
  "meeting-notes": {
    title: "Toplantı notları",
    description: "Gündem, notlar, kararlar ve sorumlusu belli yapılacaklar.",
    markdown: `| | |
| --- | --- |
| Tarih | |
| Katılımcılar | |
| Yöneten | |

## Gündem

1.
2.
3.

## Notlar

-

## Kararlar

:::callout success
Her kararı, sonradan okuyan herkesin anlayacağı tek bir cümleyle yaz.
:::

-

## Yapılacaklar

- [ ] İş, sorumlu, son tarih
- [ ] İş, sorumlu, son tarih
`,
  },
  "project-plan": {
    title: "Proje planı",
    description: "Hedef, kapsam, kilometre taşları, riskler ve görev dağılımı.",
    markdown: `## Hedef

*Başarı neye benziyor, onu nasıl ölçeceğiz?*

## Kapsam

**Dahil:**

-

**Hariç:**

-

## Kilometre taşları

| Kilometre taşı | Tarih | Sorumlu | Durum |
| --- | --- | --- | --- |
| Başlangıç | | | Bitti |
| İlk taslak | | | |
| Yayın | | | |

## Riskler

:::callout warning
Ters gidebilecekleri erkenden yaz; o sırada yön değiştirmek hâlâ ucuzdur.
:::

| Risk | Olasılık | Plan |
| --- | --- | --- |
| | Düşük / Orta / Yüksek | |

## Ekip

- **Sorumlu:**
- **Katkı verenler:**

## Açık sorular

- [ ]
`,
  },
  "weekly-plan": {
    title: "Haftalık plan",
    description: "Öncelikler, gün gün işler ve hafta sonunda kısa bir değerlendirme.",
    markdown: `## Bu haftanın üç önceliği

1.
2.
3.

## Pazartesi

- [ ]

## Salı

- [ ]

## Çarşamba

- [ ]

## Perşembe

- [ ]

## Cuma

- [ ]

## Değerlendirme

:::toggle Hafta nasıl geçti?
**Bitenler:**

**Bitmeyenler ve nedeni:**

**Gelecek hafta:**
:::
`,
  },
};

export const generalDe: GeneralSet = {
  "video-script": {
    title: "Videoskript",
    description: "Ein YouTube-Video vom Hook bis zum Call to Action, mit Shots und Notizen.",
    markdown: `| | |
| --- | --- |
| Arbeitstitel | |
| Ziellänge | 8–12 Min. |
| Veröffentlichung | |
| Status | Idee / Skript / Dreh / Schnitt / Veröffentlicht |

## Versprechen

*Ein Satz: Was weiß oder kann die Zuschauerin nach dem Video?*

## Hook (erste 15 Sekunden)

> Sag das Spannendste zuerst.

## Einstieg

- Für wen das Video ist
- Was man davon hat

## Hauptteil

### 1. Erster Punkt

Text:

Bilder / B-Roll:

### 2. Zweiter Punkt

Text:

Bilder / B-Roll:

### 3. Dritter Punkt

Text:

Bilder / B-Roll:

## Call to Action

- [ ] Abonnieren oder folgen
- [ ] Link in der Beschreibung
- [ ] Nächstes Video

## Ideen für Thumbnail und Titel

1.
2.
3.

:::toggle Beschreibung und Tags
**Beschreibung:**

**Kapitel:** 00:00 Einstieg

**Tags:**
:::
`,
  },
  "blog-post": {
    title: "Blogartikel",
    description: "Ein Artikel mit Zielgruppe, Gliederung, Entwurf und Checkliste vor dem Veröffentlichen.",
    markdown: `| | |
| --- | --- |
| Zielgruppe | |
| Haupt-Keyword | |
| Veröffentlichung | |

:::callout idea
Schreib zuerst die Gliederung. Mit einer klaren Gliederung geht der Entwurf doppelt so schnell.
:::

## Die eine Idee

*Wenn Leser sich einen Satz merken, welcher soll es sein?*

## Gliederung

1. Einleitung: das Problem
2. Erster Punkt
3. Zweiter Punkt
4. Fazit: was jetzt zu tun ist

## Entwurf

Hier losschreiben.

## Vor dem Veröffentlichen

- [ ] Titel unter 60 Zeichen
- [ ] Meta-Beschreibung
- [ ] Bilder mit Alt-Text
- [ ] Links geprüft
- [ ] Einmal laut gelesen
`,
  },
  newsletter: {
    title: "Newsletter",
    description: "Eine Ausgabe: Betreffzeile, Hauptthema, kurze Links und was als Nächstes kommt.",
    markdown: `| | |
| --- | --- |
| Ausgabe | #1 |
| Versanddatum | |
| Betreffzeile | |
| Vorschautext | |

## Hallo

Ein kurzer, persönlicher Einstieg.

## Hauptthema

Was passiert ist, warum es wichtig ist, was Leser damit anfangen können.

## Kurze Links

- **Erster Link:** warum sich der Klick lohnt
- **Zweiter Link:**
- **Dritter Link:**

## Demnächst

Was als Nächstes kommt und wie Leser antworten können.

- [ ] Korrektur gelesen
- [ ] Test an dich selbst geschickt
- [ ] Geplant
`,
  },
  "meeting-notes": {
    title: "Besprechungsnotizen",
    description: "Agenda, Notizen, Entscheidungen und Aufgaben mit Verantwortlichen.",
    markdown: `| | |
| --- | --- |
| Datum | |
| Teilnehmende | |
| Moderation | |

## Agenda

1.
2.
3.

## Notizen

-

## Entscheidungen

:::callout success
Schreib jede Entscheidung als einen Satz, den später jeder versteht.
:::

-

## Aufgaben

- [ ] Aufgabe, verantwortlich, Termin
- [ ] Aufgabe, verantwortlich, Termin
`,
  },
  "project-plan": {
    title: "Projektplan",
    description: "Ziel, Umfang, Meilensteine, Risiken und wer was macht.",
    markdown: `## Ziel

*Woran erkennen wir Erfolg, und wie messen wir ihn?*

## Umfang

**Dabei:**

-

**Nicht dabei:**

-

## Meilensteine

| Meilenstein | Datum | Verantwortlich | Status |
| --- | --- | --- | --- |
| Kickoff | | | Erledigt |
| Erster Entwurf | | | |
| Start | | | |

## Risiken

:::callout warning
Halte früh fest, was schiefgehen kann, solange ein Kurswechsel noch billig ist.
:::

| Risiko | Wahrscheinlichkeit | Plan |
| --- | --- | --- |
| | Niedrig / Mittel / Hoch | |

## Team

- **Verantwortlich:**
- **Mitwirkende:**

## Offene Fragen

- [ ]
`,
  },
  "weekly-plan": {
    title: "Wochenplan",
    description: "Prioritäten, Aufgaben Tag für Tag und ein kurzer Rückblick am Wochenende.",
    markdown: `## Die drei Prioritäten der Woche

1.
2.
3.

## Montag

- [ ]

## Dienstag

- [ ]

## Mittwoch

- [ ]

## Donnerstag

- [ ]

## Freitag

- [ ]

## Rückblick

:::toggle Wie lief die Woche?
**Erledigt:**

**Nicht erledigt, und warum:**

**Nächste Woche:**
:::
`,
  },
};
