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

/** Starts the server. Cheap and fast — it does not load a model until asked to generate. */
async function start(log) {
  const port = await findFreePort();
  baseUrl = `http://127.0.0.1:${port}`;

  const logFd = openLog(paths.ollamaLog);
  child = spawn(paths.ollamaBin, ['serve'], {
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

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) log(`The AI engine stopped unexpectedly (code ${code}).`);
    child = null;
  });

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
  if (!child) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  await Promise.race([exited, new Promise((r) => setTimeout(r, 8000))]);
  if (child) child.kill('SIGKILL');
  child = null;
}

module.exports = { start, stop, ensureModels, missingModels, TEACH_MODEL, FAST_MODEL, REQUIRED_MODELS };
