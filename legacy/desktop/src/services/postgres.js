'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const { paths } = require('../paths');
const { findFreePort } = require('../lib/net');

const execFileAsync = promisify(execFile);

/**
 * Runs a private PostgreSQL server for this installation.
 *
 * The app keeps real PostgreSQL rather than swapping in an embedded Java database because
 * the schema depends on things only PostgreSQL provides — most importantly partial unique
 * indexes, which enforce "one active prompt version per name" and "one global mastery
 * config row" at the database level. H2 cannot express those at all, so switching would
 * have meant demoting real constraints to hopeful application code and maintaining a second
 * SQL dialect for every future migration. Bundling the server keeps all 24 existing
 * migrations, and every future one, working unchanged.
 *
 * The bundled distribution is deliberately minimal — it contains initdb, pg_ctl and
 * postgres, and no client tools at all. Everything below is written against those three,
 * which is why the server is driven through pg_ctl rather than probed with pg_isready and
 * why the application uses the database initdb already creates rather than making one with
 * psql. The JDBC driver in the backend is the only client this app ever needs.
 */

// initdb always creates a database of this name owned by the bootstrap superuser. Using it
// avoids needing a client tool purely to issue one CREATE DATABASE.
const DB_NAME = 'postgres';
const DB_USER = 'aria';

let port = null;

const isInitialised = () => fs.existsSync(path.join(paths.pgData, 'PG_VERSION'));
const pidFile = () => path.join(paths.pgData, 'postmaster.pid');

/**
 * Creates the data directory. Runs once, on the very first launch after install.
 * The superuser password is supplied through a file rather than the command line so it
 * never appears in the process list.
 */
async function initdb(password, log) {
  log('Preparing the database (first run only)...');
  fs.mkdirSync(path.dirname(paths.pgData), { recursive: true });

  const pwFile = path.join(paths.data, '.pgpw');
  fs.writeFileSync(pwFile, password, { mode: 0o600 });
  try {
    await execFileAsync(paths.postgresBin('initdb'), [
      '-D', paths.pgData,
      '-U', DB_USER,
      '--pwfile', pwFile,
      '--auth-local=scram-sha-256',
      '--auth-host=scram-sha-256',
      '-E', 'UTF8',
      '--locale=C',
    ]);
  } finally {
    fs.rmSync(pwFile, { force: true });
  }

  // Belt and braces: even though we only ever pass a loopback listen address, pin the
  // config so a stray postgres started against this directory cannot expose the family's
  // data to the network.
  fs.appendFileSync(path.join(paths.pgData, 'postgresql.conf'),
    "\n# Aria Learn: never listen beyond this machine.\nlisten_addresses = '127.0.0.1'\n");
}

/**
 * Clears a server left behind by a previous run that did not shut down.
 *
 * If the app was force-quit or crashed, the postmaster may still be holding the data
 * directory, and starting a second one against it fails. Stopping it first turns a hard
 * startup error into an invisible recovery.
 */
async function stopStaleServer(log) {
  if (!fs.existsSync(pidFile())) return;
  log('Cleaning up from the last session...');
  try {
    await execFileAsync(paths.postgresBin('pg_ctl'), ['-D', paths.pgData, '-m', 'immediate', '-w', '-t', '20', 'stop']);
  } catch {
    // Nothing was running; the pid file was simply stale. pg_ctl refuses to start when a
    // stale file remains, so remove it.
    fs.rmSync(pidFile(), { force: true });
  }
}

/**
 * Starts the server and returns the connection details the backend needs.
 *
 * pg_ctl with -w does the waiting for us: it returns only once the server is accepting
 * connections, which is exactly the readiness signal we would otherwise have to reconstruct
 * by polling with a client tool this distribution does not include.
 *
 * @returns {Promise<{url: string, user: string, password: string, port: number}>}
 */
async function start(password, log) {
  if (!isInitialised()) await initdb(password, log);
  await stopStaleServer(log);

  port = await findFreePort();
  log('Starting the database...');

  const options = [
    `-p ${port}`,
    '-h 127.0.0.1',
    // Unix sockets under userData rather than /tmp, so two accounts on one Mac cannot
    // collide and no other user can reach this socket.
    ...(process.platform === 'win32' ? [] : [`-k "${paths.pgSocketDir}"`]),
  ].join(' ');

  try {
    await execFileAsync(paths.postgresBin('pg_ctl'), [
      '-D', paths.pgData,
      '-l', paths.postgresLog,
      '-o', options,
      '-w', '-t', '60',
      'start',
    ]);
  } catch (err) {
    log(`Database failed to start: ${err.message}`);
    throw new Error('The database could not be started.');
  }

  return {
    url: `jdbc:postgresql://127.0.0.1:${port}/${DB_NAME}`,
    user: DB_USER,
    password,
    port,
  };
}

/**
 * Stops the server the way PostgreSQL wants to be stopped.
 *
 * "fast" mode rolls back open transactions and checkpoints before exiting; killing the
 * process instead would leave the cluster needing recovery on next launch, which is a
 * frightening delay to hand a parent who simply closed the window.
 */
async function stop(log = () => {}) {
  if (!fs.existsSync(pidFile())) return;
  try {
    await execFileAsync(paths.postgresBin('pg_ctl'), ['-D', paths.pgData, '-m', 'fast', '-w', '-t', '20', 'stop']);
  } catch (err) {
    log(`Database shutdown reported: ${err.message}`);
  }
}

module.exports = { start, stop, DB_NAME, DB_USER };
