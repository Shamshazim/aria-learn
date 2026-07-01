# 🦉 Aria Learn — Offline AI Tutor for Any Subject (Self-Hosted)

Aria Learn is a full-stack, **100% local** AI tutoring platform for kids, built to grow across
subjects. Its friendly tutor **Aria** teaches concepts, generates unlimited
practice/quizzes/homework, evaluates work like a patient teacher, tracks mastery per subject and
grade, adapts to each child, and motivates with XP, streaks, and badges — all powered by a
**local LLM (Ollama)** with **no cloud calls and no API keys**. Unplug the internet and it still teaches.

- **Subjects:** Mathematics and English Writing, **Grades 1–8** (350+ topics, fully seeded).
- **Roles:** a **Parent/Admin** manages children, subjects, and settings; each **Student**
  learns, practices, and earns rewards.
- **Per-child:** lessons are generated and tailored to each child's level; progress, mastery,
  and recommendations are tracked separately per subject.

> ⚠️ **Privacy:** every lesson, answer, and grade is generated and stored **on your own machine**.
> Your children's accounts and progress live only in your local PostgreSQL database — they are
> **never** part of this repository. See [Privacy & Data](#-privacy--data).

---

## ✨ Features

- **Engaging lessons** — kid-friendly explanations with **rendered visuals** (groups, arrays,
  number lines, fraction bars, shapes) and **read-aloud** (browser text-to-speech).
- **The full learning loop** — Learn → Examples → Guided practice (with hints) → Practice →
  Quiz → Homework → AI evaluation → Mastery.
- **Mastery gating** — topics stay locked until the previous one is mastered.
- **AI grading** — multiple-choice is instant; open-ended answers are judged by the AI so
  *any valid answer* is accepted (not just one stored answer), with feedback.
- **Adaptive** — per-child strengths/weaknesses, recommendations, and auto-adjusting difficulty.
- **Gamification** — XP, levels, learning streaks, badges, daily/weekly goals.
- **Parent dashboard** — overview cards, charts, per-child insights, **PDF reports**.
- **Notifications** — achievements, mastery, unlocks, homework, daily reminders.
- **Admin** — add/edit curriculum and AI prompts (with a live test runner) from the UI.

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Java 21, Spring Boot 3.4, PostgreSQL, Flyway, JWT auth (RBAC) |
| AI | **Ollama** serving Qwen2.5 (7B for teaching/grading, 3B for fast hints) |
| Frontend | React 18 + TypeScript + Vite + Recharts |
| PDF | OpenPDF |

---

## ✅ Prerequisites

Install these once. Versions are minimums.

| Tool | Version | Purpose |
|------|---------|---------|
| **JDK** | 21+ | Run the backend |
| **Node.js** | 18+ | Run the frontend (includes `npm`) |
| **PostgreSQL** | 14+ | Database |
| **Ollama** | latest | Local AI models |
| **Git** | any | Clone the repo |

> You do **not** need Maven installed — the repo ships a Maven wrapper (`mvnw` / `mvnw.cmd`).

### Hardware
The AI runs locally, so you need a machine that can run a **7-billion-parameter model**:
- **Recommended:** Apple Silicon Mac (16 GB+ unified memory) **or** a GPU with **8 GB+ VRAM**.
- **CPU-only works** but lessons/answers generate slowly (tens of seconds).
- ~7 GB of free disk for the two models.

---

## 🚀 Setup

There are five steps: **install tools → set up the database → set up Ollama → run the backend →
run the frontend.** Pick your OS for the install commands; the rest is identical.

### 1) Install the tools

<details open>
<summary><b>macOS</b> (using <a href="https://brew.sh">Homebrew</a>)</summary>

```bash
# Install Homebrew first if you don't have it: https://brew.sh
brew install openjdk@21 node postgresql@16 ollama git
brew services start postgresql@16      # start the database
```

Make the JDK visible to your shell (Apple Silicon path shown):
```bash
echo 'export PATH="/opt/homebrew/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
java -version    # should print 21 (or newer)
```
</details>

<details>
<summary><b>Windows</b> (PowerShell)</summary>

Install each from its official site (or via `winget`):

```powershell
winget install EclipseAdoptium.Temurin.21.JDK
winget install OpenJS.NodeJS.LTS
winget install PostgreSQL.PostgreSQL.16
winget install Ollama.Ollama
winget install Git.Git
```
Then **close and reopen PowerShell** so the new tools are on your `PATH`.

- PostgreSQL installs as a Windows service (starts automatically). During install you set a
  password for the `postgres` superuser — **remember it**, you'll use it in the next step.
- Verify: `java -version` (21+), `node -v` (18+), `psql --version`, `ollama --version`.
</details>

### 2) Set up the database

The app expects a database named `mathtutor` owned by a role `mathtutor` (password `mathtutor`).
Create them once:

<details open>
<summary><b>macOS</b></summary>

```bash
psql -d postgres -c "CREATE ROLE mathtutor LOGIN PASSWORD 'mathtutor';"
psql -d postgres -c "CREATE DATABASE mathtutor OWNER mathtutor;"
```
</details>

<details>
<summary><b>Windows</b> (PowerShell — uses the <code>postgres</code> superuser)</summary>

```powershell
# You'll be prompted for the 'postgres' password you set during install.
psql -U postgres -c "CREATE ROLE mathtutor LOGIN PASSWORD 'mathtutor';"
psql -U postgres -c "CREATE DATABASE mathtutor OWNER mathtutor;"
```
If `psql` isn't found, add PostgreSQL's `bin` folder to PATH (e.g.
`C:\Program Files\PostgreSQL\16\bin`) or use **pgAdmin** to run the two SQL statements.
</details>

> Tables and the full curriculum are created automatically on first run (Flyway migrations + a
> curriculum seeder). You don't run any SQL beyond the two lines above.

### 3) Set up Ollama (the local AI)

```bash
ollama serve            # start the Ollama server (macOS/Windows app may already run it)
ollama pull qwen2.5:7b  # teaching & grading model (~4.7 GB)
ollama pull qwen2.5:3b  # fast hints model (~1.9 GB)
```
> On macOS/Windows the Ollama app usually runs the server in the background already; if so you
> can skip `ollama serve`. Confirm with `ollama list`.

### 4) Run the backend

```bash
cd backend
./mvnw spring-boot:run        # macOS/Linux
#   mvnw.cmd spring-boot:run  # Windows PowerShell
```
The API starts on **http://localhost:8081** (Swagger docs at `/swagger-ui.html`).
On first run it applies the database schema, seeds the Grade 1–8 curriculum, and creates a
**demo parent account**.

### 5) Run the frontend

In a **second terminal**:

```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173** 🎉

---

## 👤 First use

1. Sign in as the auto-created demo parent:
   - **Email:** `parent@demo.com`
   - **Password:** `parent123`
2. **Add a child** (choose **Mathematics** or **English Writing** and a grade).
3. Sign out, then sign in as your child (the username/password you just created).
4. The child sees their curriculum — start at the first topic and **Learn → Practice → Quiz**.
5. Back as the parent: a child's **Insights → Subjects** lets you enroll them in more subjects
   or move them up a grade. **Insights → Reports** generates a printable PDF.

> The first lesson/quiz for a topic takes a few seconds while the model thinks (and longer the
> very first time, as the model loads into memory). After that it's cached.

---

## ⚙️ Configuration

Everything has sensible local defaults — you don't need to set anything to run locally. To
override, set environment variables before starting the backend.

| Variable | Default | Notes |
|----------|---------|-------|
| `DB_URL` | `jdbc:postgresql://localhost:5432/mathtutor` | Database URL |
| `DB_USER` / `DB_PASSWORD` | `mathtutor` / `mathtutor` | Database credentials |
| `SERVER_PORT` | `8081` | Backend port (frontend proxy expects 8081) |
| `JWT_SECRET` | dev placeholder | **Change this** if you expose the app beyond localhost |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server |
| `OLLAMA_TEACH_MODEL` | `qwen2.5:7b` | Teaching/grading model |
| `OLLAMA_FAST_MODEL` | `qwen2.5:3b` | Fast hints model |

Example (macOS/Linux): `SERVER_PORT=9000 ./mvnw spring-boot:run`
Example (Windows): `$env:SERVER_PORT=9000; mvnw.cmd spring-boot:run`

---

## 📚 Extending the curriculum

Two ways:
1. **In the app:** Parent → **📚 Curriculum** to add/edit subjects, grades, units, lessons, and
   topics (soft-delete preserves student history).
2. **As data:** drop a JSON file into `backend/src/main/resources/curriculum/` (copy the shape of
   `math-4-8.json`). It loads automatically and idempotently on the next backend start — a great
   way to add a new subject (Science, History, …).

AI prompts can be edited and tested live in the app: Parent → **🤖 Prompts**.

---

## 🗂️ Project structure

```
aria-learn/
├── backend/                 Spring Boot API (Java)
│   ├── src/main/java/com/mathtutor/   feature modules (auth, curriculum, ai, practice,
│   │                                  quiz, homework, mastery, adaptive, gamification,
│   │                                  progress, enrollment, notification, report, parent)
│   ├── src/main/resources/
│   │   ├── db/migration/      Flyway SQL migrations (schema + seed data)
│   │   └── curriculum/        Grade 1–8 curriculum JSON (Math, English)
│   └── mvnw / mvnw.cmd        Maven wrapper (no global Maven needed)
├── frontend/                React + TypeScript + Vite app
│   └── src/                  pages, components, api client
└── README.md
```

---

## 🧪 Testing

```bash
cd backend && ./mvnw test     # backend unit tests (no DB/AI required)
cd frontend && npm run build  # type-check + production build
```

---

## 🛠️ Troubleshooting

| Symptom | Fix |
|---------|-----|
| **Port 8081 already in use** | Another app is using it. Start with `SERVER_PORT=9000 ./mvnw spring-boot:run` (and update `frontend/vite.config.ts` proxy target to match). |
| **`Connection refused` to the database** | PostgreSQL isn't running. macOS: `brew services start postgresql@16`. Windows: start the *postgresql-x64-16* service. |
| **`password authentication failed`** | Re-run the two `CREATE ROLE/DATABASE` commands in step 2, or set `DB_USER`/`DB_PASSWORD` to match your setup. |
| **AI errors / "Local AI model is unavailable"** | Make sure `ollama serve` is running and `ollama list` shows `qwen2.5:7b` and `qwen2.5:3b`. |
| **First lesson is very slow** | The model is loading into memory on first use; subsequent generations are much faster (and cached per topic). |
| **`java: command not found` / wrong version** | Ensure a JDK **21+** is installed and on your PATH (`java -version`). |
| **Frontend can't reach the API** | Confirm the backend is up at http://localhost:8081 and the Vite proxy points to it. |

---

## 🔒 Privacy & Data

- **Fully offline AI.** All generation runs on your local Ollama — no data leaves your machine,
  no third-party API, no keys.
- **Your children's data is local only.** Student accounts, answers, mastery, and progress live
  in **your PostgreSQL database**, which is *not* part of this repository and is excluded by
  `.gitignore`. Cloning this repo gives you the **code and curriculum**, never anyone's data.
- The only seeded account is a generic demo parent (`parent@demo.com`) for first login — change
  or delete it as you like.
- If you ever back up your database, treat that backup as private — don't commit it.

---

## 📄 License

Personal/educational project. Use it for your own family and learning.
