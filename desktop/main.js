// PageHut desktop: the hosted app in its own window, so GitHub sign-in and team sync work as on
// the web. The page gets no Node.js access (contextIsolation + sandbox); only PageHut and GitHub's
// sign-in pages may load in the window, everything else opens in the default browser.
"use strict";

const { app, BrowserWindow, Menu, nativeTheme, session, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const APP_URL = new URL(process.env.PAGEHUT_URL || "https://pagehut.vercel.app");
const LOCALES = ["tr", "en", "de"];
/** Hosts the window may navigate to: the app, and GitHub for sign-in and app installation. */
const ALLOWED_HOSTS = new Set([APP_URL.host, "github.com"]);

function startUrl() {
  const lang = app.getLocale().slice(0, 2).toLowerCase();
  return new URL(`/${LOCALES.includes(lang) ? lang : "en"}`, APP_URL).toString();
}

const isAllowed = (url) => {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" && ALLOWED_HOSTS.has(u.host)) || (u.protocol === "http:" && u.host === APP_URL.host && u.hostname === "localhost");
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

  // Links that open a new window (e.g. "view on GitHub") go to the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: "deny" };
  });
  // In-window navigation stays on PageHut and GitHub sign-in; anything else opens outside.
  const guard = (event, url) => {
    if (!isAllowed(url)) {
      event.preventDefault();
      openOutside(url);
    }
  };
  win.webContents.on("will-navigate", guard);
  win.webContents.on("will-redirect", guard);

  // No connection: show the offline page, which retries by itself when the network returns.
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted, e.g. a redirect */) return;
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

  app.whenReady().then(() => {
    // The app asks for nothing beyond copying to the clipboard.
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === "clipboard-sanitized-write"));

    // macOS needs an app menu for copy/paste shortcuts; elsewhere the window needs none.
    Menu.setApplicationMenu(
      process.platform === "darwin"
        ? Menu.buildFromTemplate([{ role: "appMenu" }, { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" }])
        : null,
    );
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
