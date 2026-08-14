'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { paths } = require('../src/paths');

/**
 * The engine must come back on its own when it dies, and on the *same* port.
 *
 * The backend is handed the engine's URL once, in its environment, and cannot learn a new one.
 * So an engine that restarts on a different port is no better than one that never restarts: the
 * app keeps running with a healthy database and backend, and every lesson fails. That is what
 * happened in practice — a stray `pkill -f "ollama serve"` on the host matched the bundled
 * engine, and the app sat broken for two days because nothing tried to start it again.
 *
 * These tests stand a fake engine in place of the real binary: a tiny HTTP server that answers
 * /api/tags like Ollama does, and exits on demand so a crash can be simulated.
 */

const FAKE_ENGINE = `#!/usr/bin/env node
const http = require('node:http');
const [host, port] = process.env.OLLAMA_HOST.split(':');
http.createServer((req, res) => {
  if (req.url === '/_crash') { process.exit(1); }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ models: [{ name: 'qwen2.5:7b' }, { name: 'qwen2.5:3b' }] }));
}).listen(Number(port), host);
`;

function useFakeEngine() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aria-ollama-'));
  const bin = path.join(dir, 'fake-ollama.js');
  fs.writeFileSync(bin, FAKE_ENGINE, { mode: 0o755 });

  for (const [key, value] of Object.entries({
    ollamaBin: bin,
    ollamaLog: path.join(dir, 'ollama.log'),
    models: path.join(dir, 'models'),
  })) {
    Object.defineProperty(paths, key, { value, configurable: true });
  }
  return dir;
}

/** Resolves once the engine answers on `baseUrl`, or throws after `timeoutMs`. */
async function waitUntilUp(baseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(500) });
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

test('the engine restarts itself on the same port after an unexpected exit', async (t) => {
  useFakeEngine();
  const ollama = require('../src/services/ollama');
  t.after(() => ollama.stop().catch(() => {}));

  const { baseUrl } = await ollama.start(() => {});
  assert.ok(await waitUntilUp(baseUrl, 5_000), 'engine should be up after start');

  // Kill it the way a stray pkill would: the process dies, nothing else is told.
  await fetch(`${baseUrl}/_crash`).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));

  assert.ok(
    await waitUntilUp(baseUrl, 20_000),
    'engine should have been restarted automatically on the same port',
  );
});

test('a deliberate stop is not treated as a crash and does not restart', async () => {
  useFakeEngine();
  // A fresh module instance so state from the previous test does not leak in.
  delete require.cache[require.resolve('../src/services/ollama')];
  const ollama = require('../src/services/ollama');

  const { baseUrl } = await ollama.start(() => {});
  assert.ok(await waitUntilUp(baseUrl, 5_000), 'engine should be up after start');

  await ollama.stop();

  // Well past the first restart delay — it must stay down.
  await new Promise((r) => setTimeout(r, 3_000));
  const stillUp = await waitUntilUp(baseUrl, 500);
  assert.strictEqual(stillUp, false, 'a stopped engine must not be restarted');
});
