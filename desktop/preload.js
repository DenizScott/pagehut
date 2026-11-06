// The only bridge between the page and the desktop app: GitHub sign-in (device flow) and the
// token. Nothing else from Node or Electron is reachable from the page.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pagehutDesktop", {
  startSignIn: () => ipcRenderer.invoke("github:start"),
  finishSignIn: () => ipcRenderer.invoke("github:finish"),
  cancelSignIn: () => ipcRenderer.invoke("github:cancel"),
  getToken: () => ipcRenderer.invoke("github:token"),
  signOut: () => ipcRenderer.invoke("github:signout"),
});
