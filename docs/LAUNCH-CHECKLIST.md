# Launch checklist (manual)

Nothing on this list has been registered or created. Each item needs the project owner's own
account and decision. Tick items off here as they are done.

## Names and handles

- [ ] **GitHub organization `pagehut`.** Create it at <https://github.com/organizations/plan>
      (free plan), then move or create the public repo as `pagehut/pagehut`. If the name is taken,
      pick a fallback (for example `pagehut-app`) and update `README.md` links.
- [ ] **npm package name `pagehut`.** Only needed if a CLI or library is ever published. Check
      <https://www.npmjs.com/package/pagehut>; reserving it requires publishing a package, so do it
      only when there is something real to publish.
- [ ] **Domains `pagehut.app` and `pagehut.dev`.** Check availability with any registrar. `.app` and
      `.dev` require HTTPS (HSTS preloaded), which Vercel and Cloudflare Pages provide for free.

## Legal

- [ ] **Trademark search** for "PageHut" in the software classes (Nice class 9 and 42). A first
      web search (2026-11-06) found no registered mark or app named exactly "PageHut"; similar
      names exist (PageHound, PageCloud, PageProof). This is not a legal clearance: before a
      commercial launch, search the official registers:
  - Türk Patent ve Marka Kurumu: <https://www.turkpatent.gov.tr> (marka araştırma)
  - EUIPO: <https://euipo.europa.eu/eSearch/>
  - Optionally WIPO Global Brand Database: <https://branddb.wipo.int>
- [ ] **Logo similarity check** for the "Folded Shelter" mark (`src/app/icon.svg`): reverse image search and a figurative-mark search (TÜRKPATENT / EUIPO image search) before launch.
- [ ] **Possible confusion with an existing project.** A small, unrelated project named *PageHut*
      already exists on GitHub (a self-hosted static-site hosting tool). Before launch, look at it,
      decide whether the overlap matters, and consider a distinguishing tagline
      (for example "PageHut: free writing and planning workspace").

## Windows download warning (SmartScreen)

- [ ] Edge/Chrome show "PageHut-Setup-win-x64.exe isn't commonly downloaded" (Publisher: Unknown) and
      offer **Delete**, and Windows warns again on first start. Reported 2026-11-07. Cause: the
      installer is unsigned and new, so it has no SmartScreen reputation yet. Workaround for users is
      in the README (Delete ▸ Keep ▸ Keep anyway). Lasting fix, free for open-source projects: apply
      to **SignPath Foundation** (https://signpath.org) for code signing and sign the Windows build in
      `.github/workflows/desktop.yml`; reputation then builds with downloads.

## Before the first public deploy

- [ ] GitHub App for sign-in: follow `docs/GITHUB-SETUP.md`. Use a separate app for production,
      with the production callback URL.
- [x] License: MIT (`LICENSE`). Chosen because the project is meant to be free for students and
      teams to use, change and self-host, and every dependency is under a compatible permissive
      license.
- [ ] Privacy note: documents are stored only in the browser or in the user's GitHub repo.
- [x] First deployment on Vercel (Hobby, no payment method): <https://pagehut.vercel.app>, project
      `pagehut`, connected to the GitHub repo so every push to `main` deploys. Lighthouse on the
      live site (2026-11-06): accessibility 100, best practices 100, SEO 100; performance 85–86
      on mobile, 89–99 on desktop. GitHub sign-in is off there until a production GitHub App is
      created and its four variables are added in Vercel.
- [ ] Optional: build the Docker image once (`docker build -t pagehut .`). Docker was not
      available on the development machine, so the image itself is untested; the standalone
      server it runs was tested.
