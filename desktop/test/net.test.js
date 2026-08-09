'use strict';

const test = require('node:test');
const assert = require('node:assert');
const net = require('node:net');

const { findFreePort, waitFor } = require('../src/lib/net');

test('findFreePort returns a port that can actually be bound', async () => {
  const port = await findFreePort();
  assert.ok(port > 0 && port < 65536, `expected a valid port, got ${port}`);

  // The whole point is that the port is free by the time we use it.
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
});

test('findFreePort does not hand out the same port twice in a row', async () => {
  const ports = await Promise.all([findFreePort(), findFreePort(), findFreePort()]);
  assert.strictEqual(new Set(ports).size, ports.length, `ports collided: ${ports}`);
});

test('waitFor resolves as soon as the check passes', async () => {
  let calls = 0;
  await waitFor(async () => ++calls >= 3, { timeoutMs: 5000, intervalMs: 10, label: 'test' });
  assert.strictEqual(calls, 3);
});

test('waitFor rejects with the label when the check never passes', async () => {
  await assert.rejects(
    () => waitFor(async () => false, { timeoutMs: 100, intervalMs: 10, label: 'the database' }),
    /Timed out waiting for the database/);
});
