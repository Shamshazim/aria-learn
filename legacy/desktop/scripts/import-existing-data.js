'use strict';

/**
 * Moves an existing development database into the desktop app's own database.
 *
 * Anyone who ran Aria Learn from source before installing the desktop build has their real
 * family data — children, mastery, XP, quizzes, homework — in the PostgreSQL server they
 * installed themselves. The desktop app deliberately creates a *separate*, private database,
 * so on first launch it knows nothing about any of that and the children cannot sign in.
 * This script is the bridge.
 *
 * It transfers the source database wholesale rather than copying the interesting tables out
 * of it. That matters: student progress references curriculum rows by UUID, and the desktop
 * install seeded its own curriculum with *different* UUIDs, so a row-by-row merge would
 * produce dangling references. Replacing the contents keeps every foreign key intact,
 * because everything then comes from one internally consistent database.
 *
 * The parent's sign-in details are carried across from the desktop install rather than the
 * source, so the username and password chosen in the setup wizard keep working — and the old
 * well-known demo account does not come back with the data.
 *
 * Run with Electron, not node — the database password is encrypted with the OS keystore and
 * only Electron's safeStorage can read it back:
 *
 *   npx electron scripts/import-existing-data.js --source mathtutor
 *
 * Options:
 *   --source <db>       source database name          (default: mathtutor)
 *   --source-user <u>   source role                   (default: current user)
 *   --source-port <p>   source port                   (default: 5432)
 *   --drop-test-users   also delete accounts named qa_test_student
 *   --dry-run           report what would happen, change nothing
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFile, execFileSync } = require('node:child_process');
const { promisify } = require('node:util');
const { app } = require('electron');

const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const SOURCE_DB = flag('source', 'mathtutor');
const SOURCE_USER = flag('source-user', process.env.USER);
const SOURCE_PORT = flag('source-port', '5432');
const DRY_RUN = has('dry-run');

const log = (msg) => console.log(msg);
const fail = (msg) => { console.error(`\n✗ ${msg}`); app.exit(1); };

// Launched as "electron <script>", Electron names itself after the script rather than the
// app, and would therefore look for the database in the wrong place — and, worse, decrypt
// secrets against the wrong keystore entry. Pin both to the real app's identity, taken from
// package.json so it cannot drift.
const { productName } = require('../package.json');
app.setName(productName);
app.setPath('userData', path.join(app.getPath('appData'), productName));

app.whenReady().then(main);

async function main() {
  try {
    const { paths } = require('../src/paths');
    const secrets = require('../src/secrets');

    log('\nAria Learn — import existing data\n');

    if (!fs.existsSync(paths.pgData)) {
      return fail('The desktop app has no database yet. Launch it once, create your parent '
        + 'account, quit it, then run this again.');
    }
    // Importing underneath a running app would corrupt what it has open.
    if (fs.existsSync(path.join(paths.data, 'SingletonLock'))) {
      return fail('Aria Learn appears to be running. Quit it completely, then run this again.');
    }
    requireTool('pg_dump');
    requireTool('psql');

    const { dbPassword } = secrets.loadOrCreate();

    await withDesktopDatabase(paths, dbPassword, async (sql, restoreFile) => {
      // 1. Remember the credentials created in the setup wizard, before anything is replaced.
      const parent = await currentParent(sql);
      if (!parent) {
        return fail('No parent account found in the desktop app. Launch it, complete the '
          + 'setup wizard, quit, then run this again.');
      }
      log(`  Desktop parent account : ${parent.email}`);

      // 2. Read the source.
      const students = await sourceStudents();
      if (students.length === 0) return fail(`No students found in "${SOURCE_DB}".`);
      log(`  Children to import     : ${students.join(', ')}`);

      if (DRY_RUN) {
        log('\n  --dry-run: stopping here, nothing was changed.\n');
        return;
      }

      // 3. Snapshot the source and swap it in.
      const dump = path.join(app.getPath('temp'), `aria-import-${Date.now()}.sql`);
      log('\n  Exporting the existing database...');
      await dumpSource(dump);

      log('  Replacing the desktop database...');
      await sql('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      await restoreFile(dump);
      fs.rmSync(dump, { force: true });

      // 4. Put the wizard's credentials back on the imported parent, so the account the
      //    parent already knows is the one that owns the imported children.
      log('  Restoring your parent sign-in...');
      await adoptParent(sql, parent);

      if (has('drop-test-users')) {
        await sql("DELETE FROM students WHERE username = 'qa_test_student';");
        log('  Removed qa_test_student.');
      }

      const imported = await sql("SELECT count(*) FROM students WHERE is_active;");
      log(`\n✓ Imported ${imported.trim()} children. Sign in as "${parent.email}" with the `
        + 'password you chose in the setup wizard.\n');
    });

    app.exit(0);
  } catch (err) {
    fail(err.message);
  }
}

function requireTool(name) {
  try {
    execFileSync('which', [name], { stdio: 'ignore' });
  } catch {
    throw new Error(`"${name}" was not found. It ships with PostgreSQL; install the client `
      + 'tools (brew install postgresql@16) and try again.');
  }
}

/** Starts the app's own PostgreSQL, runs `body`, and always stops it again. */
async function withDesktopDatabase(paths, password, body) {
  const { findFreePort } = require('../src/lib/net');
  const port = await findFreePort();
  const pgCtl = paths.postgresBin('pg_ctl');

  // Clear a lock left by a crash, otherwise the server refuses to start.
  if (fs.existsSync(path.join(paths.pgData, 'postmaster.pid'))) {
    await execFileAsync(pgCtl, ['-D', paths.pgData, '-m', 'immediate', '-w', 'stop']).catch(() => {
      fs.rmSync(path.join(paths.pgData, 'postmaster.pid'), { force: true });
    });
  }

  await execFileAsync(pgCtl, [
    '-D', paths.pgData,
    '-l', path.join(paths.logs, 'import.log'),
    '-o', `-p ${port} -h 127.0.0.1 -k "${paths.pgSocketDir}"`,
    '-w', '-t', '60', 'start',
  ]);

  const connection = ['-h', '127.0.0.1', '-p', String(port), '-U', 'aria', '-d', 'postgres'];
  const env = { ...process.env, PGPASSWORD: password };

  const sql = async (statement) => {
    const { stdout } = await execFileAsync(
      'psql', [...connection, '-v', 'ON_ERROR_STOP=1', '-tAc', statement], { env });
    return stdout;
  };

  /** Applies a dump file. Buffer is generous — these dumps run to tens of megabytes. */
  const restoreFile = async (file) => {
    await execFileAsync(
      'psql', [...connection, '-v', 'ON_ERROR_STOP=1', '-q', '-f', file],
      { env, maxBuffer: 256 * 1024 * 1024 });
  };

  try {
    await body(sql, restoreFile);
  } finally {
    await execFileAsync(pgCtl, ['-D', paths.pgData, '-m', 'fast', '-w', 'stop']).catch(() => {});
  }
}

async function currentParent(sql) {
  // Tab-separated rather than parsed as JSON: a bcrypt hash contains characters that make
  // shell-quoted JSON awkward, and the columns themselves never contain tabs.
  const row = (await sql(
    "SELECT id || E'\\t' || email || E'\\t' || name || E'\\t' || password_hash "
    + 'FROM parents ORDER BY created_at LIMIT 1;')).trim();
  if (!row) return null;
  const [id, email, name, passwordHash] = row.split('\t');
  return { id, email, name, passwordHash };
}

async function sourceStudents() {
  const { stdout } = await execFileAsync('psql', [
    '-h', '127.0.0.1', '-p', SOURCE_PORT, '-U', SOURCE_USER, '-d', SOURCE_DB,
    '-tAc', 'SELECT username FROM students WHERE is_active ORDER BY created_at;',
  ]);
  return stdout.split('\n').map((s) => s.trim()).filter(Boolean);
}

async function dumpSource(dest) {
  await execFileAsync('pg_dump', [
    '-h', '127.0.0.1', '-p', SOURCE_PORT, '-U', SOURCE_USER, '-d', SOURCE_DB,
    // The desktop cluster's roles differ from the development one, so ownership and grants
    // from the source would only fail to apply.
    '--no-owner', '--no-privileges',
    '-f', dest,
  ]);
}

/** Replaces every parent with the desktop account, keeping the imported children attached. */
async function adoptParent(sql, parent) {
  // The imported data has its own parent row (typically the seeded demo account). Point the
  // children at it, then overwrite it with the desktop credentials, so the demo login is
  // gone rather than merely hidden.
  const keeper = (await sql(
    'SELECT parent_id FROM students GROUP BY parent_id ORDER BY count(*) DESC LIMIT 1;')).trim();

  await sql(`UPDATE students SET parent_id = '${keeper}';`);
  await sql(`DELETE FROM parents WHERE id <> '${keeper}';`);
  await sql(
    'UPDATE parents SET '
    + `email = ${quote(parent.email)}, `
    + `name = ${quote(parent.name)}, `
    + `password_hash = ${quote(parent.passwordHash)} `
    + `WHERE id = '${keeper}';`);
}

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
