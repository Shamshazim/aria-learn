# Aria Learn as a desktop application

How the existing web application became something a parent downloads, installs, and runs —
and why each decision went the way it did.

---

## Part 1 — Investigation of the existing application

### 1. Current architecture

A two-part monorepo plus a test harness:

| Part | What it is |
|---|---|
| `backend/` | Spring Boot 3.4.1 on Java 21. 177 source files, ~10,200 lines, 26 REST controllers under `/api/v1` |
| `frontend/` | React 18 + TypeScript, built by Vite 6. ~1.5 MB production bundle |
| `e2e-agent/` | Playwright-driven exploratory test agent. Development-only, not shipped |

The backend is organised by feature — `auth`, `curriculum`, `ai`, `practice`, `quiz`,
`homework`, `mastery`, `adaptive`, `gamification`, `progress`, `enrollment`, `notification`,
`report`, `parent`, `tutor`, `tts`.

### 2. Frontend technology

React 18 with `react-router-dom` v6, Recharts for parent-dashboard charts, `canvas-confetti`
and `lucide-react` for the child-facing UI, self-hosted Fontsource fonts. All API access goes
through one typed client (`src/api.ts`) that attaches the JWT and transparently refreshes it
once on a 401.

**The single most useful discovery:** every request uses a *relative* path (`/api/v1/...`),
resolved in development by the Vite dev-server proxy. Nothing hardcodes a host or port. That
made it possible to serve the UI from the backend itself and leave the client untouched.

### 3. Backend technology

Spring Boot 3.4.1, Spring Web, Spring Data JPA, Spring Security, Bean Validation, Flyway,
springdoc-openapi, and OpenPDF for server-side report generation. Runs on port 8081.

### 4. Database technology

PostgreSQL, with 24 Flyway migrations (~1,127 lines of SQL) covering both schema and seed
data. Hibernate runs with `ddl-auto: validate`, so the migrations are the single source of
truth for the schema.

**Portability audit** — the decisive measurement:

- **0** native SQL queries
- **2** `@Query` annotations, both plain JPQL

The Java persistence layer is therefore completely database-agnostic. All PostgreSQL coupling
lives in the migration SQL: `UUID` (104 uses), `TIMESTAMPTZ` (34), `gen_random_uuid()` (10),
and partial unique indexes.

### 5. AI/LLM architecture

Ollama on `localhost:11434`, serving `qwen2.5:7b` for teaching and grading and `qwen2.5:3b`
for fast hints, reached over HTTP with Spring's `RestClient`. `AiClient` resolves a named,
versioned prompt from the database, calls the model, parses structured JSON, repairs once on
malformed output, and logs the call.

Already fully local — no cloud provider, no API keys, no telemetry. This was the largest
piece of the desktop conversion already being done.

### 6. Current authentication flow

Stateless JWT. `POST /api/v1/auth/login` accepts a parent email or a student username,
verifies a BCrypt hash, and returns an access token (120 min) and refresh token (30 days).
Roles are `PARENT` and `STUDENT`; tokens live in `localStorage`.

**The gap that blocked the desired first-run experience:** there was no registration endpoint
at all. Only `/login` and `/refresh` existed. The only way an account came into being was
`DataInitializer`, which seeded `parent@demo.com` / `parent123` on startup under every
profile except `prod`.

### 7. Current dependency requirements

A person had to install and configure five things by hand: a JDK 21+, Node.js 18+,
PostgreSQL 14+, Ollama, and Git — then create a database role and database with two `psql`
commands, then pull two models totalling 6.6 GB.

### 8. Current development/startup process

Two terminals, indefinitely: `./mvnw spring-boot:run` in `backend/`, `npm run dev` in
`frontend/`, with a third process (Ollama) expected to be running already.

### 9. What can run locally

Everything. The application was designed offline-first, and this conversion changed nothing
about that.

### 10. What requires internet access

Only one thing, and only once: downloading the two Ollama models on first launch. After that
the app never needs a network. Notably the AI, the database, grading, PDF reports, and all
child data are local, permanently.

---

## Part 2 — Desktop architecture

### 11. Recommended architecture (implemented)

```
┌─ Aria Learn.app ─────────────────────────────────────────────┐
│                                                              │
│  Electron main process  (src/main.js)                        │
│    supervises, in order:                                     │
│                                                              │
│    1. PostgreSQL 16.4    private cluster, random loopback port│
│    2. Ollama             private port, own model directory    │
│    3. Spring Boot        random loopback port, "desktop"      │
│                          profile, serves the React UI too     │
│                                                              │
│  BrowserWindow ──────► http://127.0.0.1:<backend port>/       │
└──────────────────────────────────────────────────────────────┘
```

Two directory trees, and the split between them is what makes updates safe:

| Tree | Location | Contents | Survives update? |
|---|---|---|---|
| Read-only payload | inside the `.app` bundle | JRE, PostgreSQL, Ollama, `backend.jar` | replaced wholesale |
| Installation data | `~/Library/Application Support/Aria Learn` | `pgdata/`, `models/`, `logs/`, `secrets.json` | **never touched** |

**Ports are allocated at runtime, never hardcoded.** Asking the OS for a free port on
127.0.0.1 means a machine already running PostgreSQL on 5432 or Ollama on 11434 — that is,
any developer's machine, and plenty of ordinary ones — has no conflict to resolve.

### ADR-1: Electron over Tauri

Both were viable. Electron won on three points specific to this application:

- **Size parity.** Tauri's usual decisive advantage nearly vanishes here. The app must ship a
  JRE, a PostgreSQL server and Ollama regardless (~250 MB), on top of ~6.6 GB of models.
  Electron's Chromium adds ~140 MB to that — a few percent of the real footprint.
- **One rendering engine.** Tauri uses WKWebView on macOS and WebView2 on Windows. This app
  leans on the Web Speech API for narration, which has *already* been a recurring source of
  hard-to-diagnose bugs in this codebase, and WKWebView is notably quirky with it. Chromium
  on both platforms removes a whole class of platform-specific defects on the most fragile
  feature.
- **No new toolchain.** The repository contains no Rust. Electron keeps maintenance inside
  the Java/TypeScript skill set already required.

### ADR-2: Bundled PostgreSQL over an embedded Java database

H2 in PostgreSQL-compatibility mode was tested directly by running all 24 migrations against
it, rather than assumed. It failed on three counts:

1. `TIMESTAMPTZ` — unknown data type, even in PostgreSQL mode (34 uses)
2. `gen_random_uuid()` — not available (10 uses)
3. **Partial unique indexes** — `CREATE UNIQUE INDEX ... WHERE ...` is not expressible in H2
   at all

The first two are mechanical substitutions. The third is not: those indexes enforce real
invariants — one active prompt version per name (`V3`), one `GLOBAL` mastery-config row
(`V5`). Moving to H2 would have demoted database-guaranteed constraints to hopeful
application code, *and* committed the project to maintaining two SQL dialects for every
future migration.

Bundling the real server costs ~136 MB and changes zero lines of SQL.

The bundled distribution contains only `initdb`, `pg_ctl` and `postgres` — no client tools.
The launcher is written against exactly those three: the server is driven through `pg_ctl -w`
(which returns only once the server accepts connections, so no `pg_isready` is needed), and
the application uses the `postgres` database that `initdb` always creates, so no `psql` is
needed to issue a `CREATE DATABASE`. The backend's JDBC driver is the only client required.

### ADR-3: Models downloaded on first run, not bundled

`qwen2.5:7b` (4.7 GB) and `qwen2.5:3b` (1.9 GB) cannot go in an installer a parent will
actually download. The installer carries the Ollama binary; the models are fetched once on
first launch behind a progress screen. This is the only step in the product that needs the
internet.

The Ollama payload is pruned from 463 MB to 96 MB at build time by removing Linux `.so`
objects (unloadable on macOS) and the `mlx_metal_*` runners (used only for MLX-format models;
qwen2.5 is GGUF and goes through llama.cpp). Verified by serving qwen2.5 from a pruned tree.

### 12. Packaging and installer

electron-builder produces a macOS `.dmg` with the conventional drag-to-Applications window.
`scripts/build-runtime.mjs` stages the payload beforehand: it builds the React app *into* the
backend's static resources, packages the jar, `jlink`s a minimal JRE (50 MB, 23 modules —
`java.desktop` is required, OpenPDF uses AWT), and fetches and prunes PostgreSQL and Ollama.

Current result: **267 MB DMG, 612 MB installed**, plus 6.6 GB of models on first run.

One architecture per build. The staged runtime is native code, so an x64 DMG must be built on
an x64 host; emitting one from an arm64 host would ship an app that cannot start its own
database. Windows/NSIS is configured but not yet built or verified.

### 13. Update mechanism

`electron-updater`, which verifies a build's signature before applying it. Updates are
deliberately **disabled until the app is signed** (`ARIA_UPDATES_ENABLED`): on macOS the
verification *is* the code signature, and an unverifiable update channel is a way to install
someone else's code on a child's computer.

Data preservation follows from the directory split above — an update replaces the bundle and
never touches `userData`. Schema changes ride along as ordinary Flyway migrations applied on
the first launch after an update. `baseline-on-migrate` is **off** in the desktop profile, so
an unexpected schema fails loudly instead of silently skipping migrations.

This was verified in practice: an account created under the development build was still
present after switching to the packaged application.

### 14. Security considerations

| Concern | How it is handled |
|---|---|
| Password storage | BCrypt via Spring Security, unchanged. Covered by a test asserting the stored value is a `$2` hash that does not contain the plaintext |
| Shipped demo account | `DataInitializer` is now disabled under `desktop` as well as `prod`. A shipped `parent@demo.com` / `parent123` would have been a working login to *every* family's install, published in this repository |
| Signing key | Generated per installation (48 random bytes) by the launcher. `DesktopEnvironmentGuard` **refuses to boot** if the key is missing, too short, or the development placeholder — a shared key would let anyone forge a parent token for any install |
| Secrets at rest | Encrypted with the OS keystore (Keychain / DPAPI) via Electron `safeStorage`; falls back to a `0600` file and says so rather than pretending |
| Network exposure | Every service binds `127.0.0.1` only, on OS-assigned ports. `listen_addresses` is additionally pinned in `postgresql.conf` |
| Frontend ↔ backend | Same origin — the backend serves the UI — so CORS is not merely configured but *removed*: the desktop profile installs a deny-everything CORS source |
| Unauthenticated surface | Only `/api/v1/auth/**` and `/api/v1/setup/**`. Setup closes permanently once a parent exists (403 thereafter); the UI shell is readable but every piece of family data sits behind `/api` and stays authenticated |
| Renderer privileges | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The splash preload exposes two read-only listeners and nothing else. External links open in the real browser instead of navigating the app window |
| API documentation | springdoc disabled in desktop builds; those paths fall through to the SPA |

**Known gap:** the build is unsigned and un-notarized, so macOS shows an "unidentified
developer" warning and the user must right-click → Open the first time. Entitlements and
hardened-runtime configuration are already in place; enabling signing is a matter of
supplying a Developer ID.

### 15. Migration strategy

Treated as an evolution, not a rewrite. Nothing was removed and the development workflow is
unchanged — `npm run dev` plus `./mvnw spring-boot:run` still behaves exactly as before,
because every desktop behaviour is gated behind the `desktop` Spring profile.

What changed in the existing application:

| File | Change |
|---|---|
| `SecurityConfig` | Permits `/api/v1/setup/**`; profile-aware CORS; serves the UI unauthenticated in desktop builds only |
| `DataInitializer` | No longer seeds a demo account in desktop builds |
| `api.ts`, `auth.tsx`, `App.tsx` | Setup status/creation calls, `adoptSession`, and a `SetupGate` |

What was added:

| Area | Files |
|---|---|
| First-run setup | `setup/SetupController`, `SetupService`, `dto/SetupDtos`, `pages/Setup.tsx` |
| Desktop profile | `application-desktop.yml`, `desktop/DesktopEnvironmentGuard`, `desktop/SpaResourceConfig` |
| Launcher | the whole `desktop/` workspace |

### Existing data

Because the desktop app deliberately creates its *own* database, an existing installation's
family data does not follow it across, and the children simply cannot sign in. That is
correct behaviour for a fresh install and wrong for anyone upgrading from a source checkout,
so `desktop/scripts/import-existing-data.js` bridges the two.

It transfers the source database wholesale rather than copying the interesting tables.
Progress rows reference curriculum by UUID, and a desktop install seeds its own curriculum
with *different* UUIDs, so a row-by-row merge would produce dangling references; replacing
the contents keeps every foreign key intact because everything comes from one internally
consistent database.

The parent credentials are taken from the desktop install rather than the source, so the
username and password chosen in the setup wizard keep working and the well-known
`parent@demo.com` account is overwritten rather than reintroduced along with the data.

Verified on a real migration: 7 children plus their 558 XP-ledger rows, 110 answers and 36
achievements moved across with zero orphaned records, and `parent@demo.com` / `parent123`
returns 401 afterwards.

---

## Verified behaviour

Confirmed by running the software, not by inspection:

- Fresh install: `initdb` → 24 migrations → 389 curriculum topics seeded → setup wizard →
  parent account → parent adds a child → child signs in
- `DesktopEnvironmentGuard` refuses to start when handed the development JWT secret
- `parent@demo.com` / `parent123` returns 401 in a desktop build
- A second call to `/api/v1/setup/parent` returns 403
- SPA deep links (`/parent/curriculum`) return the app; unknown `/api` paths do not return HTML
- Trimmed Ollama serves `qwen2.5` correctly
- Clean shutdown: PostgreSQL checkpoints, no orphaned processes
- The packaged `.app` runs all three bundled services and preserves data created earlier

## Not yet done

- Windows build (configured, never executed or verified)
- Code signing and notarization, and therefore auto-update, which stays off until signed
- The model download path is implemented and unit-tested at the parsing level, but a full
  6.6 GB first-run download was not performed end to end
- The app has no icon; electron-builder falls back to the default Electron icon
- Server-side narration remains macOS-only (`say`); Windows falls back to browser speech,
  which is the pre-existing behaviour
