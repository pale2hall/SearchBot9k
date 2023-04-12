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
  onUpdateSetText: (callback) => {
    ipcRenderer.on('update-set-text', callback);
  },

});