# PageHut desktop

The whole of PageHut in an installer. When the app opens, [Electron](https://www.electronjs.org/)
starts the bundled Next.js standalone server on this computer (`127.0.0.1:47821`, a fixed port so
the browser storage, and with it your pages, keeps the same origin) and shows it in a window. No
internet connection is needed.

- The page gets no Node.js access (`contextIsolation`, `sandbox`, no preload).
- Only the app loads in the window; other links open in the default browser.
- The server runs only while the app is open, and listens on 127.0.0.1 only.
- GitHub sign-in uses GitHub's device flow (`github.js`): the app shows a code, the person enters it
  on github.com, and the main process receives a user token. It needs only the GitHub App's public
  client id and slug (`github.json`, written by `prepare-server`), never its secret. The token is
  kept encrypted with the system's key store (`safeStorage`) and lasts 8 hours; without the secret
  it can't be refreshed. The page reaches it only through `preload.js`, which accepts calls from
  the app's own origin. The GitHub App must have **Enable Device Flow** switched on.
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
