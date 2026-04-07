const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require("electron");
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

ipcMain.handle("bench-path:select", async () => {
  const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow(), {
    title: "Select Frappe Bench Folder",
    properties: ["openDirectory"],
  });

  if (result.canceled || !result.filePaths.length) {
    return { status: "cancelled", path: "" };
  }

  return { status: "selected", path: result.filePaths[0] };
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
