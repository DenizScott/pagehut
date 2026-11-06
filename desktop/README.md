# PageHut desktop

The whole of PageHut in an installer. When the app opens, [Electron](https://www.electronjs.org/)
starts the bundled Next.js standalone server on this computer (`127.0.0.1:47821`, a fixed port so
the browser storage, and with it your pages, keeps the same origin) and shows it in a window. No
internet connection is needed.

- The page gets no Node.js access (`contextIsolation`, `sandbox`, no preload).
- Only the app loads in the window; other links open in the default browser.
- The server runs only while the app is open, and listens on 127.0.0.1 only.
- GitHub sign-in isn't available in the desktop app (an installer can't hold the GitHub App's
  secret); the GitHub dialog points to the web version instead.
- `PAGEHUT_URL=https://…` loads a hosted copy instead of the bundled server (for development).

```bash
# in the repo root
PAGEHUT_STANDALONE=1 pnpm build
# here
npm install
npm run prepare-server   # copies the server in, flattens node_modules, drops any .env file
npm start                # run it
npm run dist             # build an installer for this system (output in dist/)
```

`.github/workflows/desktop.yml` builds the Windows, macOS and Linux installers when a GitHub release
is published and attaches them to that release. They are unsigned.
