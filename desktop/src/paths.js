'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { app } = require('electron');

/**
 * Resolves the two directory trees the app cares about.
 *
 * `resources` is read-only and ships inside the installer: the Java runtime, the PostgreSQL
 * binaries, the Ollama binary and the backend jar. On macOS it lives inside the .app bundle,
 * which the OS may mount read-only and which is replaced wholesale by an update — so nothing
 * the user creates may ever be written there.
 *
 * `userData` is the opposite: it survives updates and uninstalls, and is where the database,
 * the downloaded models, the logs and the per-install secrets live. Keeping that split strict
 * is what makes "update the app without losing the children's progress" work.
 */

const isPackaged = () => app.isPackaged;

/** Root of the bundled, read-only payload. */
function resourcesRoot() {
  // In development the payload is staged by scripts/build-runtime.mjs into desktop/resources.
  return isPackaged()
    ? path.join(process.resourcesPath, 'runtime')
    : path.join(__dirname, '..', 'resources');
}

/** Root of everything this installation owns and must not lose. */
function dataRoot() {
  return app.getPath('userData');
}

const paths = {
  get resources() { return resourcesRoot(); },
  get data() { return dataRoot(); },

  // Bundled payload ---------------------------------------------------------
  get javaHome() { return path.join(resourcesRoot(), 'jre'); },
  get javaBin() {
    const exe = process.platform === 'win32' ? 'java.exe' : 'java';
    return path.join(resourcesRoot(), 'jre', 'bin', exe);
  },
  get backendJar() { return path.join(resourcesRoot(), 'backend.jar'); },
  get postgresRoot() { return path.join(resourcesRoot(), 'postgres'); },
  postgresBin(name) {
    const exe = process.platform === 'win32' ? `${name}.exe` : name;
    return path.join(resourcesRoot(), 'postgres', 'bin', exe);
  },
  get ollamaBin() {
    const exe = process.platform === 'win32' ? 'ollama.exe' : 'ollama';
    return path.join(resourcesRoot(), 'ollama', exe);
  },

  // Per-installation, preserved across updates -------------------------------
  get pgData() { return path.join(dataRoot(), 'pgdata'); },
  get pgSocketDir() { return path.join(dataRoot(), 'pgsock'); },
  get models() { return path.join(dataRoot(), 'models'); },
  get logs() { return path.join(dataRoot(), 'logs'); },
  get secretsFile() { return path.join(dataRoot(), 'secrets.json'); },
  get backendLog() { return path.join(dataRoot(), 'logs', 'backend.log'); },
  get postgresLog() { return path.join(dataRoot(), 'logs', 'postgres.log'); },
  get ollamaLog() { return path.join(dataRoot(), 'logs', 'ollama.log'); },

  /** Creates the writable directories. Safe to call on every launch. */
  ensure() {
    for (const dir of [dataRoot(), paths.logs, paths.models, paths.pgSocketDir]) {
      fs.mkdirSync(dir, { recursive: true });
    }
  },
};

module.exports = { paths };
