# PageHut desktop

An [Electron](https://www.electronjs.org/) window around the hosted app
(<https://pagehut.vercel.app>, or `PAGEHUT_URL`), so sign-in and sync work as on the web.

- The page gets no Node.js access (`contextIsolation`, `sandbox`, no preload).
- Only PageHut and GitHub's sign-in pages load in the window; other links open in the default
  browser.
- Without a connection it shows `offline.html`, which reloads the app when the network returns.

```bash
npm install
npm start            # run it
npm run dist         # build an installer for this system (output in dist/)
```

Installers for all three systems are built by `.github/workflows/desktop.yml` when a GitHub
release is published, and attached to that release. They are unsigned; see the main README for
the first-start warnings.
