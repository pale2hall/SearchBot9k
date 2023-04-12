const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  onUpdateMessages: (callback) => {
    ipcRenderer.on('update-messages', callback);
  },
  onUpdateWebPageImage: (callback) => {
    ipcRenderer.on('update-webpage-image', callback);
  },
  onUpdateAnswer: (callback) => {
    ipcRenderer.on('update-answer', callback);
  },
  onUpdateURL: (callback) => {
    ipcRenderer.on('update-URL', callback);
  },
  onUpdateTokenUsage: (callback) => {
    ipcRenderer.on('update-token-usage', callback);
  },
  onUpdateWebActivity: (callback) => {
    ipcRenderer.on('update-web-activity', callback);
  },
  onUpdateSetHTML: (callback) => {
    ipcRenderer.on('update-set-HTML', callback);
  },
});