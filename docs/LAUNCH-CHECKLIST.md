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

- [ ] **Trademark search** for "PageHut" in the software classes (Nice class 9 and 42):
  - Türk Patent ve Marka Kurumu: <https://www.turkpatent.gov.tr> (marka araştırma)
  - EUIPO: <https://euipo.europa.eu/eSearch/>
  - Optionally WIPO Global Brand Database: <https://branddb.wipo.int>
- [ ] **Logo similarity check** for the "Folded Shelter" mark (`src/app/icon.svg`): reverse image search and a figurative-mark search (TÜRKPATENT / EUIPO image search) before launch.
- [ ] **Possible confusion with an existing project.** A small, unrelated project named *PageHut*
      already exists on GitHub (a self-hosted static-site hosting tool). Before launch, look at it,
      decide whether the overlap matters, and consider a distinguishing tagline
      (for example "PageHut for game design documents").

## Before the first public deploy

- [ ] GitHub App for sign-in: follow `docs/GITHUB-SETUP.md`. Use a separate app for production,
      with the production callback URL.
- [ ] Choose the license (MIT proposed) and add `LICENSE`.
- [ ] Privacy note: documents are stored only in the browser or in the user's GitHub repo.
- [ ] First deployed preview: import the repo on Vercel (Hobby) with your own account, following
      `docs/DEPLOY.md`. Then run Lighthouse on the preview URL and check that accessibility is
      at least 95.
- [ ] Optional: build the Docker image once (`docker build -t pagehut .`). Docker was not
      available on the development machine, so the image itself is untested; the standalone
      server it runs was tested.
