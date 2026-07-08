'use strict';
// The renderer is a sandboxed web page that talks to Supabase over HTTPS.
// It needs no Node APIs, so we expose only a tiny, read-only surface.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('adminApp', {
  platform: process.platform,
  saveCSV: (filename, content) => ipcRenderer.invoke('save-csv', { filename, content }),
  appVersion: () => ipcRenderer.invoke('app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  openReleases: () => ipcRenderer.invoke('open-releases'),
  onUpdateStatus: (cb) => { ipcRenderer.on('update-status', (e, s) => { try { cb(s); } catch (err) { /* ignore */ } }); }
});
