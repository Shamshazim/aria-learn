'use strict';

const path = require('node:path');
const { app, BrowserWindow, shell, dialog } = require('electron');

const { paths } = require('./paths');
const secrets = require('./secrets');
const postgres = require('./services/postgres');
const backend = require('./services/backend');
const ollama = require('./services/ollama');
const { checkForUpdates } = require('./updater');

/**
 * The desktop entry point.
 *
 * Everything the README used to ask a person to do by hand — install a JDK, install and
 * configure PostgreSQL, create a role and a database, install Ollama, pull two models, then
 * run two long-lived commands in two terminals — happens here instead, in order, behind a
 * progress screen. A parent sees a splash and then their app.
 */

let splash = null;
let mainWindow = null;
let shuttingDown = false;

// A single instance owns the database directory. A second copy would fail to start
// PostgreSQL against the same data directory and confuse everyone involved.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return;
}

function createSplash() {
  splash = new BrowserWindow({
    width: 520,
    height: 400,
    resizable: false,
    frame: false,
    show: true,
    backgroundColor: '#1b1035',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  splash.loadFile(path.join(__dirname, 'ui', 'splash.html'));
}

/** Sends a human-readable status line to the splash screen. */
function report(message) {
  if (splash && !splash.isDestroyed()) splash.webContents.send('boot:status', message);
}

function reportProgress(payload) {
  if (splash && !splash.isDestroyed()) splash.webContents.send('boot:progress', payload);
}

function createMainWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#ffffff',
    title: 'Aria Learn',
    webPreferences: {
      // The renderer displays the app's own UI and needs no privileged APIs, so it gets
      // none: no Node integration, context isolation on, and no preload of our own.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Anything that is not our local app — a curriculum link, a help page — opens in the real
  // browser instead of navigating this window somewhere we no longer control.
  const isOwnOrigin = (url) => url.startsWith(`http://127.0.0.1:${port}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isOwnOrigin(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isOwnOrigin(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (splash && !splash.isDestroyed()) splash.destroy();
    splash = null;
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

async function boot() {
  paths.ensure();
  report('Getting things ready...');

  const installSecrets = secrets.loadOrCreate();
  if (!secrets.encryptionAvailable()) {
    // Not fatal — the file is still owner-only — but worth recording honestly.
    console.warn('OS keystore unavailable; secrets stored with file permissions only.');
  }

  const db = await postgres.start(installSecrets.dbPassword, report);

  report('Waking up the AI...');
  const ai = await ollama.start(report);

  // Done before the backend so a first lesson is never attempted against a missing model.
  const missing = await ollama.missingModels();
  if (missing.length > 0) {
    report("Downloading Aria's brain. This happens once, and needs the internet.");
    await ollama.ensureModels(({ model, index, of, fraction }) => {
      reportProgress({ model, index, of, fraction });
    });
    reportProgress(null);
  }

  const port = await backend.start(db, installSecrets, ai, report);
  createMainWindow(port);

  // Only after the app is usable, and never blocking it.
  checkForUpdates().catch((err) => console.warn('Update check failed:', err.message));
}

/** Stops the children in reverse order of the dependencies between them. */
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await backend.stop().catch(() => {});
  await ollama.stop().catch(() => {});
  await postgres.stop(console.warn).catch(() => {});
}

app.whenReady().then(async () => {
  createSplash();
  try {
    await boot();
  } catch (err) {
    console.error(err);
    if (splash && !splash.isDestroyed()) splash.destroy();
    dialog.showErrorBox(
      'Aria could not start',
      `${err.message}\n\nTechnical details were written to:\n${paths.logs}`);
    await shutdown();
    app.quit();
  }
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  // macOS convention keeps apps alive without windows, but this one supervises a database
  // and a language model; leaving those running after the last window closes would be rude.
  app.quit();
});

// Give the services a chance to close cleanly before the process goes away.
app.on('before-quit', (event) => {
  if (shuttingDown) return;
  event.preventDefault();
  shutdown().finally(() => app.quit());
});
