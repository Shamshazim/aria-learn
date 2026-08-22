'use strict';

const net = require('node:net');

/**
 * Asks the OS for an unused loopback port.
 *
 * The app cannot hardcode 8081/5432/11434 the way the development setup does: those are
 * exactly the ports a developer's own PostgreSQL or Ollama is already sitting on, and a
 * parent whose machine happens to run something on 8081 should never see a startup failure.
 * Binding to port 0 lets the kernel pick, and 127.0.0.1 keeps every service off the network.
 */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** Resolves once `check` returns true, or rejects after `timeoutMs`. */
async function waitFor(check, { timeoutMs, intervalMs = 300, label = 'service' }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

module.exports = { findFreePort, waitFor };
