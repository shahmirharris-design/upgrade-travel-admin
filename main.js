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
// background, and installs them on the next restart. Silent unless something is found.
function setupAutoUpdate() {
  let autoUpdater;
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', async (info) => {
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
  autoUpdater.on('error', (err) => { console.warn('update check failed:', err && err.message); });
  try { autoUpdater.checkForUpdates(); } catch (e) { /* offline or dev, ignore */ }
}

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
