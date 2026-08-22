#!/usr/bin/env node
/**
 * Rewrites the checksums in latest-mac.yml to match the disk image as it now stands.
 *
 * electron-builder writes that manifest immediately after building the DMG, and signing and
 * stapling then change the file — so every hash in it is stale by the time the release is
 * published. Auto-update verifies downloads against those hashes, so a stale manifest is not a
 * cosmetic problem: it is an update channel that rejects its own release. It stays wrong
 * silently today only because updates are off until ARIA_UPDATES_ENABLED is set.
 *
 * The manifest is small and rigidly shaped, so it is edited line by line rather than by pulling
 * in a YAML dependency for four fields.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const distDir = process.argv[2] ?? 'dist';
const manifestPath = path.join(distDir, 'latest-mac.yml');

if (!existsSync(manifestPath)) {
  console.log('  • no latest-mac.yml; nothing to refresh');
  process.exit(0);
}

/** electron-updater compares base64-encoded SHA-512, not the usual hex. */
const sha512 = (file) => createHash('sha512').update(readFileSync(file)).digest('base64');

const digests = new Map();
for (const name of readdirSync(distDir).filter((f) => f.endsWith('.dmg'))) {
  const full = path.join(distDir, name);
  digests.set(name, { sha512: sha512(full), size: statSync(full).size });
}
if (digests.size === 0) {
  console.log('  • no .dmg alongside the manifest; nothing to refresh');
  process.exit(0);
}

const lines = readFileSync(manifestPath, 'utf8').split('\n');

// Track which file the following sha512/size lines belong to: entries under `files:` are
// introduced by `- url: <name>`, and the trailing top-level block by `path: <name>`.
let current = null;
let changed = 0;

const out = lines.map((line) => {
  const named = line.match(/^\s*(?:-\s*url|path):\s*(.+?)\s*$/);
  if (named) {
    current = digests.get(named[1]) ?? null;
    return line;
  }
  if (!current) {
    return line;
  }
  const hash = line.match(/^(\s*sha512:\s*).*$/);
  if (hash) {
    changed++;
    return hash[1] + current.sha512;
  }
  const size = line.match(/^(\s*size:\s*).*$/);
  if (size) {
    changed++;
    return size[1] + String(current.size);
  }
  return line;
});

writeFileSync(manifestPath, out.join('\n'));
console.log(`  • refreshed ${changed} checksum field(s) in latest-mac.yml`);
