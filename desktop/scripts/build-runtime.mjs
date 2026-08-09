#!/usr/bin/env node
/**
 * Assembles everything the installer ships, into desktop/resources/.
 *
 * This is the script that turns "install five tools and run two terminals" into a single
 * download. It produces:
 *
 *   resources/backend.jar   the existing Spring Boot app, with the built React UI inside it
 *   resources/jre/          a trimmed Java runtime, so no JDK is needed on the machine
 *   resources/postgres/     PostgreSQL server binaries
 *   resources/ollama        the Ollama binary (models are fetched on first run, not here)
 *
 * Steps are skipped when their output already exists; pass --clean to force a rebuild.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readdirSync, chmodSync, renameSync, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const here = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(here, '..');
const repoRoot = path.resolve(desktopDir, '..');
const backendDir = path.join(repoRoot, 'backend');
const frontendDir = path.join(repoRoot, 'frontend');
const resources = path.join(desktopDir, 'resources');
const staging = path.join(desktopDir, '.build-cache');

const clean = process.argv.includes('--clean');

// Pinned so a build is reproducible and an upstream change cannot alter what ships.
const POSTGRES_VERSION = '16.4.0';
const OLLAMA_VERSION = 'v0.32.6';

/** Java modules the backend needs. java.desktop is not optional: OpenPDF uses AWT for reports. */
const JRE_MODULES = [
  'java.base', 'java.compiler', 'java.desktop', 'java.instrument', 'java.logging',
  'java.management', 'java.naming', 'java.net.http', 'java.prefs', 'java.rmi',
  'java.scripting', 'java.security.jgss', 'java.security.sasl', 'java.sql',
  'java.sql.rowset', 'java.transaction.xa', 'java.xml', 'java.xml.crypto',
  'jdk.crypto.cryptoki', 'jdk.crypto.ec', 'jdk.jfr', 'jdk.management', 'jdk.unsupported',
].join(',');

const run = (cmd, args, cwd) => {
  console.log(`  $ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
};

const step = (name) => console.log(`\n▸ ${name}`);

async function download(url, dest) {
  console.log(`  ↓ ${url}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

/** The platform identifiers used by the two upstream projects we pull binaries from. */
function platform() {
  const { platform: os, arch } = process;
  if (os === 'darwin') {
    return {
      zonky: arch === 'arm64' ? 'darwin-arm64v8' : 'darwin-amd64',
      zonkyArchive: arch === 'arm64' ? 'postgres-darwin-arm_64.txz' : 'postgres-darwin-x86_64.txz',
      ollamaAsset: 'ollama-darwin.tgz',
    };
  }
  if (os === 'win32') {
    return { zonky: 'windows-amd64', zonkyArchive: 'postgres-windows-x86_64.txz', ollamaAsset: 'ollama-windows-amd64.zip' };
  }
  throw new Error(`Unsupported build platform: ${os}/${arch}`);
}

// ---------------------------------------------------------------------------

/**
 * Builds the React app straight into the backend's static resources.
 *
 * This is what makes the packaged app a single origin: the same jar serves the UI and the
 * API, so the frontend's relative /api/v1 calls work with no proxy and no CORS.
 */
function buildFrontend() {
  step('Building the frontend into the backend');
  const staticDir = path.join(backendDir, 'src', 'main', 'resources', 'static');
  rmSync(staticDir, { recursive: true, force: true });

  if (!existsSync(path.join(frontendDir, 'node_modules'))) run('npm', ['ci'], frontendDir);
  run('npm', ['run', 'build'], frontendDir);

  mkdirSync(staticDir, { recursive: true });
  execFileSync('cp', ['-R', `${path.join(frontendDir, 'dist')}/.`, staticDir], { stdio: 'inherit' });
}

function buildBackend() {
  step('Packaging the backend');
  const mvnw = process.platform === 'win32' ? 'mvnw.cmd' : './mvnw';
  run(mvnw, ['-q', 'clean', 'package', '-DskipTests'], backendDir);

  const jar = readdirSync(path.join(backendDir, 'target'))
    .find((f) => f.endsWith('.jar') && !f.endsWith('-sources.jar') && !f.includes('original'));
  if (!jar) throw new Error('No backend jar was produced.');

  execFileSync('cp', [path.join(backendDir, 'target', jar), path.join(resources, 'backend.jar')]);
}

/**
 * Builds a trimmed Java runtime from the JDK doing the building, so the family's machine
 * never needs a JDK of its own.
 */
function buildJre() {
  const target = path.join(resources, 'jre');
  if (existsSync(target) && !clean) { console.log('\n▸ Java runtime already staged'); return; }
  step('Building the Java runtime');
  rmSync(target, { recursive: true, force: true });

  run('jlink', [
    '--add-modules', JRE_MODULES,
    '--strip-debug', '--no-man-pages', '--no-header-files', '--compress=zip-6',
    '--output', target,
  ]);
}

async function fetchPostgres() {
  const target = path.join(resources, 'postgres');
  if (existsSync(target) && !clean) { console.log('\n▸ PostgreSQL already staged'); return; }
  step('Fetching PostgreSQL');
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  mkdirSync(staging, { recursive: true });

  const { zonky, zonkyArchive } = platform();
  const jarName = `embedded-postgres-binaries-${zonky}-${POSTGRES_VERSION}.jar`;
  const jarPath = path.join(staging, jarName);
  const url = `https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-${zonky}/`
    + `${POSTGRES_VERSION}/${jarName}`;

  if (!existsSync(jarPath)) await download(url, jarPath);

  // The Maven artifact is a jar wrapping a .txz of the actual server tree.
  const unpack = path.join(staging, 'pg-unpack');
  rmSync(unpack, { recursive: true, force: true });
  mkdirSync(unpack, { recursive: true });
  run('unzip', ['-q', '-o', jarPath, zonkyArchive, '-d', unpack]);
  run('tar', ['-xJf', path.join(unpack, zonkyArchive), '-C', target]);

  for (const bin of readdirSync(path.join(target, 'bin'))) {
    chmodSync(path.join(target, 'bin', bin), 0o755);
  }
}

async function fetchOllama() {
  const marker = path.join(resources, 'ollama');
  if (existsSync(marker) && !clean) { console.log('\n▸ Ollama already staged'); return; }
  step('Fetching Ollama');
  mkdirSync(staging, { recursive: true });

  const { ollamaAsset } = platform();
  const archive = path.join(staging, ollamaAsset);
  const url = `https://github.com/ollama/ollama/releases/download/${OLLAMA_VERSION}/${ollamaAsset}`;
  if (!existsSync(archive)) await download(url, archive);

  const unpack = path.join(staging, 'ollama-unpack');
  rmSync(unpack, { recursive: true, force: true });
  mkdirSync(unpack, { recursive: true });

  if (ollamaAsset.endsWith('.zip')) run('unzip', ['-q', '-o', archive, '-d', unpack]);
  else run('tar', ['-xzf', archive, '-C', unpack]);

  // The tarball unpacks to a tree of the binary plus its runner libraries.
  rmSync(marker, { recursive: true, force: true });
  renameSync(unpack, marker);
  const exe = path.join(marker, process.platform === 'win32' ? 'ollama.exe' : 'ollama');
  if (existsSync(exe)) chmodSync(exe, 0o755);

  pruneOllama(marker);
}

/**
 * Drops runner libraries this build will never load. On macOS that is 463 MB down to 96 MB.
 *
 * Upstream ships one archive covering every accelerator and CPU generation:
 *
 *  - The .so files are Linux objects; a macOS build cannot load them at all.
 *  - mlx_metal_* are runners for models in MLX format. Aria teaches with qwen2.5 in GGUF
 *    format, which goes through the llama.cpp path instead, so these are never opened.
 *    Verified by serving qwen2.5 from a pruned tree and generating successfully.
 *
 * Windows is deliberately left alone, even though its archive is far larger. The bulk of it
 * is the CUDA and ROCm runners, and unlike macOS — where Metal support is built in — those
 * are the only way a Windows machine uses its GPU. Stripping them would shrink the installer
 * to a few hundred megabytes and make every lesson painfully slow on the NVIDIA and AMD
 * hardware most Windows families have. A larger download that works beats a small one that
 * frustrates.
 *
 * If a future model ships as MLX, this is the first place to look.
 */
function pruneOllama(root) {
  const removable = readdirSync(root).filter((entry) =>
    entry.endsWith('.so') || (process.platform === 'darwin' && entry.startsWith('mlx_metal_')));

  for (const entry of removable) {
    rmSync(path.join(root, entry), { recursive: true, force: true });
  }
  console.log(`  pruned ${removable.length} unused runner libraries`);
}

async function main() {
  if (clean) rmSync(resources, { recursive: true, force: true });
  mkdirSync(resources, { recursive: true });

  buildFrontend();
  buildBackend();
  buildJre();
  await fetchPostgres();
  await fetchOllama();

  step('Runtime staged in desktop/resources');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
