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
  onUpdateSetVal: (callback) => {
    ipcRenderer.on('update-set-val', callback);
  },
  onUpdateSetText: (callback) => {
    ipcRenderer.on('update-set-text', callback);
  },
  togglePauseAI: (pauseState) => {
    ipcRenderer.send('pause', pauseState);
  },
  askAI: (request) => {
    ipcRenderer.send('ask-ai', request);
  }


});
