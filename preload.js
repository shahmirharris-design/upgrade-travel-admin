'use strict';
// The renderer is a sandboxed web page that talks to Supabase over HTTPS.
// It needs no Node APIs, so we expose only a tiny, read-only surface.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adminApp', {
  version: '0.1.0',
  platform: process.platform,
  saveCSV: (filename, content) => ipcRenderer.invoke('save-csv', { filename, content })
});
