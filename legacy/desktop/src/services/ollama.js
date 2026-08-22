'use strict';

const { spawn } = require('node:child_process');

const { paths } = require('../paths');
const { findFreePort, waitFor } = require('../lib/net');
const { openLog } = require('../lib/logfile');
const { createNdjsonParser } = require('../lib/ndjson');

/**
 * Runs the bundled Ollama server and makes sure the models Aria teaches with are present.
 *
 * The models are the one thing that genuinely cannot ship inside the installer: qwen2.5:7b
 * and qwen2.5:3b are about 6.6 GB together, which would make the download unusable for most
 * families. So the installer carries the Ollama binary (tens of megabytes) and the models
 * are fetched once, on first launch, behind a progress screen. After that the app is fully
 * offline — this is the only step in the entire product that needs the internet.
 *
 * The server is started on a private loopback port with its own model directory, so it
 * neither collides with nor disturbs an Ollama the user may already run themselves.
 */

const TEACH_MODEL = 'qwen2.5:7b';
const FAST_MODEL = 'qwen2.5:3b';
const REQUIRED_MODELS = [TEACH_MODEL, FAST_MODEL];

let child = null;
let baseUrl = null;
let port = null;
let report = () => {};
let stopping = false;
let restarting = false;

/**
 * How long to wait before each restart attempt. The engine is respawned on the *same* port it
 * was given at startup: the backend is handed its URL once, in its environment, and has no way
 * to learn a new one — so a restart that moved ports would leave the app just as broken.
 */
const RESTART_DELAYS_MS = [1_000, 2_000, 5_000, 15_000, 30_000];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isUp() {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Model names already downloaded into this installation's model directory. */
async function installedModels() {
  const res = await fetch(`${baseUrl}/api/tags`);
  if (!res.ok) return [];
  const body = await res.json();
  return (body.models ?? []).map((m) => m.name);
}

async function missingModels() {
  const installed = await installedModels();
  // Ollama reports "qwen2.5:7b"; be tolerant of an implicit :latest on either side.
  const normalise = (n) => (n.includes(':') ? n : `${n}:latest`);
  const have = new Set(installed.map(normalise));
  return REQUIRED_MODELS.filter((m) => !have.has(normalise(m)));
}

/** Spawns the server process on the current port and supervises its exit. */
function spawnServer() {
  const logFd = openLog(paths.ollamaLog);
  const proc = spawn(paths.ollamaBin, ['serve'], {
    env: {
      ...process.env,
      OLLAMA_HOST: `127.0.0.1:${port}`,
      OLLAMA_MODELS: paths.models,
      // Keep a loaded model resident between questions; reloading 4.7 GB between a lesson
      // and its quiz is the difference between "thinking" and "broken".
      OLLAMA_KEEP_ALIVE: '15m',
    },
    stdio: ['ignore', logFd, logFd],
  });

  proc.on('exit', (code) => {
    child = null;
    if (stopping) return;
    report(`The AI engine stopped unexpectedly (code ${code}). Restarting it...`);
    void restart();
  });
  return proc;
}

/**
 * Brings the engine back after it dies, retrying with a widening delay.
 *
 * Without this the app stays running with its database and backend healthy but no AI at all,
 * and every lesson fails with a message a parent cannot act on. That is not hypothetical: a
 * stray `pkill -f "ollama serve"` on the host matches this very process, and the app then sat
 * broken for two days because nothing ever tried to start it again.
 */
async function restart() {
  if (restarting || stopping) return;
  restarting = true;
  try {
    for (let attempt = 1; attempt <= RESTART_DELAYS_MS.length; attempt++) {
      await sleep(RESTART_DELAYS_MS[attempt - 1]);
      if (stopping) return;
      try {
        child = spawnServer();
        await waitFor(isUp, { timeoutMs: 60_000, label: "Aria's AI engine" });
        report("Aria's AI engine is back.");
        return;
      } catch (err) {
        report(`Could not restart the AI engine (attempt ${attempt} of ${RESTART_DELAYS_MS.length}).`);
      }
    }
    report('Aria\'s AI engine could not be restarted. Please quit and reopen Aria Learn.');
  } finally {
    restarting = false;
  }
}

/** Starts the server. Cheap and fast — it does not load a model until asked to generate. */
async function start(log) {
  report = typeof log === 'function' ? log : () => {};
  stopping = false;
  port = await findFreePort();
  baseUrl = `http://127.0.0.1:${port}`;

  child = spawnServer();

  await waitFor(isUp, { timeoutMs: 60_000, label: "Aria's AI engine" });
  return { baseUrl, teachModel: TEACH_MODEL, fastModel: FAST_MODEL };
}

/** Downloads one model, reporting progress as a 0..1 fraction. */
async function pullModel(name, onProgress) {
  const res = await fetch(`${baseUrl}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`Could not download ${name} (${res.status})`);

  const decoder = new TextDecoder();
  const parser = createNdjsonParser();

  for await (const chunk of res.body) {
    for (const event of parser.push(decoder.decode(chunk, { stream: true }))) {
      if (event.error) throw new Error(event.error);
      if (event.total > 0) onProgress(Math.min(1, (event.completed ?? 0) / event.total));
    }
  }
  onProgress(1);
}

/**
 * Ensures every required model is present, reporting overall progress across all of them.
 * @param {(info: {model: string, index: number, of: number, fraction: number}) => void} onProgress
 */
async function ensureModels(onProgress) {
  const missing = await missingModels();
  for (let i = 0; i < missing.length; i++) {
    const model = missing[i];
    await pullModel(model, (fraction) =>
      onProgress({ model, index: i + 1, of: missing.length, fraction }));
  }
  return missing;
}

async function stop() {
  // Set before killing, so the exit handler treats this as intentional and does not restart it.
  stopping = true;
  if (!child) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  await Promise.race([exited, new Promise((r) => setTimeout(r, 8000))]);
  if (child) child.kill('SIGKILL');
  child = null;
}

module.exports = { start, stop, ensureModels, missingModels, TEACH_MODEL, FAST_MODEL, REQUIRED_MODELS };
