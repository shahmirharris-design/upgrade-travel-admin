'use strict';
const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Native "Save as…" for CSV exports from the Reports tab.
ipcMain.handle('save-csv', async (event, { filename, content }) => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export report',
    defaultPath: filename || 'report.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (canceled || !filePath) return { ok: false };
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#211A11',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Any window.open / external link opens in the system browser, never a new app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Auto-update: checks GitHub Releases on launch, downloads new versions in the
// background, and installs them on the next restart. Also exposes a manual
// "Check for updates" (from Settings) and always offers a download-page fallback
// (needed on macOS, where an unsigned/ad-hoc build cannot self-install).
const RELEASES_URL = 'https://github.com/shahmirharris-design/upgrade-travel-admin/releases/latest';
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch (e) { autoUpdater = null; }

function sendUpdateStatus(s) {
  BrowserWindow.getAllWindows().forEach(function (w) { try { w.webContents.send('update-status', s); } catch (e) { /* window gone */ } });
}
function cmpVer(a, b) {
  const pa = String(a).split('.').map(function (n) { return parseInt(n, 10) || 0; });
  const pb = String(b).split('.').map(function (n) { return parseInt(n, 10) || 0; });
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return 1; if ((pa[i] || 0) < (pb[i] || 0)) return -1; }
  return 0;
}

function setupAutoUpdate() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = true;
  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => sendUpdateStatus({ state: 'available', version: info && info.version }));
  autoUpdater.on('update-not-available', () => sendUpdateStatus({ state: 'none' }));
  autoUpdater.on('download-progress', (p) => sendUpdateStatus({ state: 'downloading', percent: Math.round((p && p.percent) || 0) }));
  autoUpdater.on('update-downloaded', async (info) => {
    sendUpdateStatus({ state: 'downloaded', version: info && info.version });
    const win = BrowserWindow.getAllWindows()[0];
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      title: 'Update ready',
      message: 'A new version of Upgrade Travel Admin is ready.',
      detail: 'Version ' + (info && info.version ? info.version : '') + ' will be installed when you restart.'
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', (err) => { sendUpdateStatus({ state: 'error', message: (err && err.message) || 'Update failed.' }); console.warn('update error:', err && err.message); });
  try { autoUpdater.checkForUpdates(); } catch (e) { /* offline or dev, ignore */ }
}

ipcMain.handle('app-version', () => app.getVersion());
ipcMain.handle('open-releases', () => { shell.openExternal(RELEASES_URL); return { ok: true }; });
ipcMain.handle('check-for-updates', async () => {
  const current = app.getVersion();
  if (!autoUpdater) return { ok: false, current, message: 'The updater is not available in this build.' };
  try {
    const r = await autoUpdater.checkForUpdates();
    const latest = r && r.updateInfo && r.updateInfo.version;
    return { ok: true, current, latest: latest || current, available: latest ? cmpVer(latest, current) > 0 : false };
  } catch (e) {
    return { ok: false, current, message: (e && e.message) || 'Could not check for updates.' };
  }
});

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdate();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
