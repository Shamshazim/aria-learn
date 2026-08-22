'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * The splash screen's only capability: listening to boot progress.
 *
 * Deliberately one-way and read-only. The splash renders text and a progress bar, so it has
 * no reason to be able to call back into the main process, and giving it that ability would
 * be handing a renderer privileges it does not need.
 */
contextBridge.exposeInMainWorld('ariaBoot', {
  onStatus: (handler) => ipcRenderer.on('boot:status', (_event, message) => handler(message)),
  onProgress: (handler) => ipcRenderer.on('boot:progress', (_event, payload) => handler(payload)),
});
