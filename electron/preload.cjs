const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("networkAccess", {
  getNetworkDetails: () => ipcRenderer.invoke("network-access:get"),
  openExternal: (url) => ipcRenderer.invoke("network-access:open", url),
  copyText: (text) => ipcRenderer.invoke("network-access:copy", text),
});
