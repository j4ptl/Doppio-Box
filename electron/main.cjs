const { app, BrowserWindow, clipboard, ipcMain, shell } = require("electron");
const path = require("node:path");
const { getNetworkAccess } = require("./networkAccess.cjs");

const devServerUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:5173";

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (process.env.NODE_ENV === "production") {
    window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    window.loadURL(devServerUrl);
  }
}

ipcMain.handle("network-access:get", () => getNetworkAccess());

ipcMain.handle("network-access:open", async (_event, url) => {
  await shell.openExternal(url);
  return { status: "opened" };
});

ipcMain.handle("network-access:copy", (_event, text) => {
  clipboard.writeText(text);
  return { status: "copied" };
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
