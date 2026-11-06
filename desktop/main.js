// PageHut desktop. The whole app ships inside the installer: Electron starts the bundled Next.js
// server on this computer (127.0.0.1, a fixed port so the browser storage keeps the same origin
// and your pages stay put) and shows it in a window. No internet connection and no website are
// needed. The page gets no Node.js access (contextIsolation + sandbox); links to other sites open
// in the default browser.
//
// For development, PAGEHUT_URL=https://… loads a hosted copy instead of the bundled server.
"use strict";

const { app, BrowserWindow, Menu, dialog, nativeTheme, session, shell, utilityProcess } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = 47821;
const LOCAL_URL = new URL(`http://127.0.0.1:${PORT}`);
const REMOTE_URL = process.env.PAGEHUT_URL ? new URL(process.env.PAGEHUT_URL) : null;
const APP_URL = REMOTE_URL ?? LOCAL_URL;
const LOCALES = ["tr", "en", "de"];

function startUrl() {
  const lang = app.getLocale().slice(0, 2).toLowerCase();
  return new URL(`/${LOCALES.includes(lang) ? lang : "en"}`, APP_URL).toString();
}

/** The window may only show the app itself; everything else opens in the default browser. */
const isAllowed = (url) => {
  try {
    return new URL(url).origin === APP_URL.origin;
  } catch {
    return false;
  }
};

const openOutside = (url) => {
  try {
    const u = new URL(url);
    if (u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:") void shell.openExternal(u.toString());
  } catch {
    /* ignore malformed links */
  }
};

/* ---------- the bundled server ---------- */

let server = null;

// Packaged: unpacked next to app.asar (asarUnpack), so Node reads it as plain files.
const serverDir = () => (app.isPackaged ? path.join(process.resourcesPath, "app.asar.unpacked", "server") : path.join(__dirname, "server"));

/** Resolves true when the server answers on the port (ours or one left over from a crash). */
function ping() {
  return new Promise((resolve) => {
    const req = http.get({ host: "127.0.0.1", port: PORT, path: "/api/auth/status", timeout: 800 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve(res.statusCode === 200 && body.includes('"configured"')));
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

/** Is something else listening on the port? */
function portTaken() {
  return new Promise((resolve) => {
    const probe = require("node:net").createServer();
    probe.once("error", () => resolve(true));
    probe.once("listening", () => probe.close(() => resolve(false)));
    probe.listen(PORT, "127.0.0.1");
  });
}

async function startServer() {
  if (await ping()) return; // a PageHut server is already running here
  if (await portTaken()) throw new Error(`Port ${PORT} is used by another program.`);

  const dir = serverDir();
  const log = fs.createWriteStream(path.join(app.getPath("userData"), "server.log"), { flags: "w" });
  server = utilityProcess.fork(path.join(dir, "server.js"), [], {
    cwd: dir,
    stdio: "pipe",
    serviceName: "PageHut server",
    env: {
      // Keep the system's variables: on Windows, networking fails without SystemRoot.
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      PAGEHUT_DESKTOP: "1",
    },
  });
  server.stdout?.pipe(log);
  server.stderr?.pipe(log);
  server.once("exit", () => (server = null));

  for (let i = 0; i < 150; i++) {
    if (await ping()) return;
    if (!server) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("The PageHut server did not start. Details are in server.log in the app's data folder.");
}

const stopServer = () => {
  server?.kill();
  server = null;
};

/* ---------- window size and position, remembered between runs ---------- */

const stateFile = () => path.join(app.getPath("userData"), "window-state.json");
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    return { width: 1280, height: 820 };
  }
}
function saveState(win) {
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
  } catch {
    /* not critical */
  }
}

/* ---------- main window ---------- */

let mainWindow = null;

function createWindow() {
  const state = loadState();
  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width || 1280,
    height: state.height || 820,
    minWidth: 360,
    minHeight: 480,
    title: "PageHut",
    icon: path.join(__dirname, "build", "icon.png"),
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#151b18" : "#f6f4ee",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });
  if (state.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());
  win.on("close", () => saveState(win));

  win.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: "deny" };
  });
  const guard = (event, url) => {
    if (!isAllowed(url)) {
      event.preventDefault();
      openOutside(url);
    }
  };
  win.webContents.on("will-navigate", guard);
  win.webContents.on("will-redirect", guard);

  // Only a hosted copy (PAGEHUT_URL) can be unreachable; show the offline page for it.
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!REMOTE_URL || !isMainFrame || code === -3) return;
    void win.loadFile(path.join(__dirname, "offline.html"), { query: { url: url || startUrl() } });
  });

  void win.loadURL(startUrl());
  mainWindow = win;
}

/* ---------- app lifecycle ---------- */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === "clipboard-sanitized-write"));
    Menu.setApplicationMenu(
      process.platform === "darwin"
        ? Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" }])
        : null,
    );
    if (!REMOTE_URL) {
      try {
        await startServer();
      } catch (err) {
        dialog.showErrorBox("PageHut", err instanceof Error ? err.message : String(err));
        app.quit();
        return;
      }
    }
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", stopServer);
}
