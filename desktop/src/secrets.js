'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const { safeStorage } = require('electron');

const { paths } = require('./paths');

/**
 * Per-installation secrets: the database password and the JWT signing key.
 *
 * These are generated on first launch and never leave the machine. Two properties matter:
 *
 *  - They are unique per install. A signing key baked into the installer would be identical
 *    on every copy, and anyone who unpacked the app could forge a parent token for any
 *    family's install. The backend refuses to boot if it detects the development key
 *    (see DesktopEnvironmentGuard).
 *  - They are encrypted at rest with the OS keystore (Keychain on macOS, DPAPI on Windows)
 *    when it is available, so another user account on the same computer cannot read them.
 *    Where it is not available we fall back to a plain file with owner-only permissions and
 *    record that fact, rather than silently pretending the data is protected.
 */

const CURRENT_FORMAT = 2;

function generate() {
  return {
    format: CURRENT_FORMAT,
    // Postgres passwords travel over a loopback socket, but a weak one would still be the
    // obvious way in for anything else running as this user.
    dbPassword: crypto.randomBytes(24).toString('base64url'),
    // HS256 wants >= 32 bytes of key material; 48 gives headroom.
    jwtSecret: crypto.randomBytes(48).toString('base64url'),
  };
}

function encryptionAvailable() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function write(secrets) {
  const useOsKeystore = encryptionAvailable();
  const payload = useOsKeystore
    ? { format: CURRENT_FORMAT, encrypted: true, data: safeStorage.encryptString(JSON.stringify(secrets)).toString('base64') }
    : { format: CURRENT_FORMAT, encrypted: false, data: secrets };

  // 0600: readable only by the account that installed the app.
  fs.writeFileSync(paths.secretsFile, JSON.stringify(payload), { mode: 0o600 });
  // writeFileSync only applies mode when creating, so restate it for existing files.
  try { fs.chmodSync(paths.secretsFile, 0o600); } catch { /* not meaningful on Windows */ }
  return useOsKeystore;
}

function read() {
  if (!fs.existsSync(paths.secretsFile)) return null;
  const raw = JSON.parse(fs.readFileSync(paths.secretsFile, 'utf8'));

  if (raw.encrypted) {
    if (!encryptionAvailable()) {
      throw new Error(
        'Stored credentials are encrypted with the system keystore, which is currently unavailable.');
    }
    return JSON.parse(safeStorage.decryptString(Buffer.from(raw.data, 'base64')));
  }
  return raw.data;
}

/**
 * Returns this installation's secrets, creating them on first run.
 * Also re-encrypts a legacy plaintext file once the OS keystore becomes usable.
 */
function loadOrCreate() {
  const existing = read();
  if (existing) {
    const raw = JSON.parse(fs.readFileSync(paths.secretsFile, 'utf8'));
    if (!raw.encrypted && encryptionAvailable()) write(existing);
    return existing;
  }
  const fresh = generate();
  write(fresh);
  return fresh;
}

module.exports = { loadOrCreate, encryptionAvailable };
