'use strict';

const { spawn } = require('node:child_process');

const { paths } = require('../paths');
const { findFreePort, waitFor } = require('../lib/net');
const { openLog } = require('../lib/logfile');

/**
 * Runs the existing Spring Boot application as a child process against the bundled JRE.
 *
 * Nothing about the backend is rewritten for the desktop build — it is the same jar, with a
 * "desktop" profile that points it at our private database, gives it a per-install signing
 * key, and has it serve the built React app from its own classpath. That last part is what
 * lets the frontend keep its relative /api/v1 fetches and removes cross-origin concerns
 * entirely: the UI and the API are the same origin.
 *
 * Secrets reach the process through the environment rather than command-line arguments,
 * because arguments are visible to any process listing on the machine.
 */

let child = null;
let port = null;

/** The readiness probe: it proves the HTTP layer is up *and* the database answered. */
async function isHealthy(p) {
  try {
    const res = await fetch(`http://127.0.0.1:${p}/api/v1/setup/status`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * @param {{url: string, user: string, password: string}} db
 * @param {{jwtSecret: string}} secrets
 * @param {{baseUrl: string, teachModel: string, fastModel: string}} ollama
 * @returns {Promise<number>} the port the backend is listening on
 */
async function start(db, secrets, ollama, log) {
  port = await findFreePort();
  log('Starting Aria...');

  const logFd = openLog(paths.backendLog);

  child = spawn(paths.javaBin, [
    // A tutor app has no business holding a big heap; capping it keeps the app polite on a
    // family laptop that is also running the model.
    '-Xmx512m',
    '-XX:+UseSerialGC',
    '-Djava.awt.headless=true',
    '-jar', paths.backendJar,
  ], {
    env: {
      ...process.env,
      SPRING_PROFILES_ACTIVE: 'desktop',
      SERVER_PORT: String(port),
      DB_URL: db.url,
      DB_USER: db.user,
      DB_PASSWORD: db.password,
      JWT_SECRET: secrets.jwtSecret,
      OLLAMA_URL: ollama.baseUrl,
      OLLAMA_TEACH_MODEL: ollama.teachModel,
      OLLAMA_FAST_MODEL: ollama.fastModel,
      JAVA_HOME: paths.javaHome,
    },
    stdio: ['ignore', logFd, logFd],
  });

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) log(`Aria's engine stopped unexpectedly (code ${code}).`);
    child = null;
  });

  await waitFor(() => isHealthy(port), {
    // Flyway may be applying 24 migrations and seeding the whole grade 1-8 curriculum on
    // first run, which is far slower than an ordinary start.
    timeoutMs: 180_000,
    label: 'Aria to start',
  });

  log('Aria is ready.');
  return port;
}

/** SIGTERM lets Spring run its shutdown hooks and close the connection pool cleanly. */
async function stop() {
  if (!child) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  await Promise.race([exited, new Promise((r) => setTimeout(r, 10_000))]);
  if (child) child.kill('SIGKILL');
  child = null;
}

module.exports = { start, stop, isHealthy, get port() { return port; } };
