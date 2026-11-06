# Features

PageHut is free in every respect: no plans, no seats, no limits set by us. This page lists what it
does, and compares it with the features that hosted workspace apps usually sell in their paid
plans (team, business and enterprise tiers).

## Writing

- Block editor: headings, lists, to-dos, toggles, callouts, quotes, code, tables, images, dividers.
- `/` menu with localized keywords, Markdown shortcuts, a formatting toolbar, drag handles.
- Nested pages, page links with backlinks (showing the line each link is on), Ctrl/Cmd+K search.
- 14 game design templates in Turkish, English and German, and a Design Pillars strip.

## Databases

- Property types: text, number, select, multi-select, checkbox, date, link, person, relation,
  formula.
- Views: **table, board, gallery, calendar, timeline, chart and form**, each with its own filters,
  sorts and shown properties.
- Seven game templates: mechanics, scope tracker, production schedule, story beats, playtest log,
  balance table, mood board.

## Working together

- Each workspace is a GitHub repository: readable Markdown and JSON, one commit per sync.
- Automatic two-way sync with a three-way merge; overlapping edits show compare, keep mine or keep
  theirs. Nothing is ever force-pushed.
- Comments on text or pages, replies, resolve, @mentions with a mentions inbox.

## Paid-plan features elsewhere, and PageHut

| Feature usually in paid plans | PageHut |
|---|---|
| Unlimited pages and blocks for teams | Yes. No limits. |
| Unlimited file uploads | Yes, up to GitHub's file limits (warning at 1 MB, refused over 25 MB). |
| Page version history (30 days, 90 days or unlimited) | Yes, **unlimited**: every page's full Git history, with restore. |
| Guests and member seats | Yes, unlimited: anyone you add as a collaborator on the repository. |
| Permission groups | Yes, through GitHub teams and repository roles (read, write, admin). |
| Private team spaces | Yes: a private repository per team or project. |
| Charts in databases | Yes: chart view (bars by select, multi-select or checkbox; count, sum or average). |
| Forms that add database rows | Yes: form view. Conditional questions are not supported yet. |
| Bulk PDF export of the workspace | Yes: "Print or save everything as PDF" prints every page in tree order. |
| Export (Markdown, PDF, ZIP, JSON) and import | Yes, all of them, plus import of Markdown & CSV folder exports from other apps. |
| Audit log | Yes, through Git: every change is a commit with author and time; the organization audit log is GitHub's. |
| SAML single sign-on and SCIM provisioning | Through GitHub: sign-in is GitHub sign-in, so a GitHub organization's SSO and SCIM apply. |
| Custom domain and published sites | Self-host or deploy anywhere (`docs/DEPLOY.md`), on your own domain. |
| Admin controls, data residency | You own the repository and the deployment, so they are yours by design. |
| Built-in AI writing assistant | **No, on purpose.** Every AI service costs money per use; PageHut stays free to run. |
| Page view analytics | **No, on purpose.** It would mean tracking readers on a server; PageHut has none. |
| Database automations | Not yet. Planned: simple rules such as "when Status becomes Done, set Date". |
| Calendar and timeline views | Yes: a month calendar and a timeline (start and end dates), plus a production schedule template. |

## Accessibility and languages

WCAG 2.2 AA target, checked with axe on every screen in both themes and on phone layouts;
Lighthouse accessibility 100. Turkish, English and German, with right-to-left support ready.
