# Aria Learn — desktop build

Packages the existing Spring Boot backend and React frontend into a macOS application that a
non-technical parent can download, install, and run. No JDK, Node, PostgreSQL or Ollama
installation required on their machine.

Architecture and the reasoning behind it: [`../docs/desktop-architecture.md`](../docs/desktop-architecture.md).

## What the user experiences

1. Download the `.dmg`, drag Aria Learn to Applications
2. Launch it. A splash screen sets up the database and, **once**, downloads the AI models
3. Choose a parent username and password
4. Add children, and they start learning

Everything after step 2 works with no internet connection.

## Building it

Requires (on the *build* machine only): a JDK 21+ with `jlink`, Node 18+, and network access.

```bash
cd desktop
npm install
npm run dist          # stages the runtime, then builds dist/Aria Learn-<version>-arm64.dmg
```

`npm run dist:dir` skips the DMG and produces just the `.app`, which is faster while iterating.

### What the staging step does

`npm run build:runtime` (run automatically by `dist`) populates `resources/`:

| Output | How |
|---|---|
| `backend.jar` | Builds the React app **into** `backend/src/main/resources/static`, then packages the Spring Boot jar — this is what makes the shipped app a single origin |
| `jre/` | `jlink` with 23 modules (~50 MB) |
| `postgres/` | PostgreSQL 16.4 server binaries from Maven Central |
| `ollama/` | Ollama, pruned from 463 MB to 96 MB |

Pass `--clean` to force a re-fetch. `resources/` and `.build-cache/` are gitignored.

Architectures cannot be cross-compiled: the payload is native code, so an Intel build must be
staged on an Intel machine.

## Running it during development

```bash
npm start
```

Uses `resources/` directly instead of an app bundle, so `npm run build:runtime` must have run
at least once. Only one instance can run at a time — the app holds a lock on its data
directory — so stop a packaged copy before starting a development one.

```bash
npm test              # launcher unit tests
```

## Bringing existing data across

The desktop app creates its **own private database**, so if you previously ran Aria Learn
from source, your children are in the PostgreSQL server you installed yourself and the
desktop app will not see them — their sign-in will be rejected as an unknown user.

To move them across, launch the app once and complete the setup wizard, quit it, then:

```bash
npx electron scripts/import-existing-data.js --source mathtutor --dry-run   # look first
npx electron scripts/import-existing-data.js --source mathtutor
```

It transfers the source database wholesale — children, mastery, XP, quizzes, homework,
achievements — rather than copying selected tables, because progress rows reference
curriculum by UUID and the desktop install seeded its own curriculum with different UUIDs; a
row-by-row merge would leave dangling references.

The source database is only ever read. The parent username and password you chose in the
wizard are carried onto the imported data, so the old `parent@demo.com` account is overwritten
rather than restored alongside it.

| Option | Effect |
|---|---|
| `--source <db>` | source database name (default `mathtutor`) |
| `--source-user`, `--source-port` | source role and port |
| `--drop-test-users` | also delete `qa_test_student` |
| `--dry-run` | report what would change, change nothing |

It must run under `electron`, not `node`: the database password is encrypted with the OS
keystore, which only Electron's `safeStorage` can read back.

## Where things live at runtime

`~/Library/Application Support/Aria Learn/`

| Path | Contents |
|---|---|
| `pgdata/` | The PostgreSQL cluster: accounts, children, progress |
| `models/` | Downloaded AI models |
| `logs/` | `backend.log`, `postgres.log`, `ollama.log` — start here when something misbehaves |
| `secrets.json` | Database password and JWT signing key, encrypted with the OS keystore |

**Nothing here is touched by an update.** Deleting this directory resets the application to a
fresh install and destroys all family data.

## Signing and giving it to other people

Builds are currently **ad-hoc signed and not notarized**, which means macOS refuses to open
them on any machine other than the one that built them — Gatekeeper reports `no usable
signature`. That is not a warning a user can click past.

Making the app installable by someone else requires an Apple Developer ID ($99/year).
Entitlements and hardened-runtime settings are already in place, and
`.github/workflows/release-desktop.yml` builds, signs, notarizes and publishes to GitHub
Releases as soon as the signing secrets exist.

Step-by-step certificate guide: [`../docs/apple-signing.md`](../docs/apple-signing.md).
Costs, workarounds, and the hardware the other person needs:
[`../docs/distributing.md`](../docs/distributing.md).
