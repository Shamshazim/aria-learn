# Aria Learn — Claude Code Context

## Project overview
AI-powered tutoring app for children. Spring Boot 3.4.1 backend + React/Vite/TypeScript frontend.
AI engine: Ollama (Qwen2.5 7B/3B) running locally, accessed via RestClient.

## How to run

### Backend
```bash
cd /Users/shams/aria-learn/backend
./mvnw spring-boot:run
```
Runs on http://localhost:8080. DB: Postgres at localhost:5432 (db=mathtutor, user=mathtutor, password=mathtutor).

### Frontend
```bash
cd /Users/shams/aria-learn/frontend
npm run dev
```
Runs on http://localhost:5173.

### Desktop app
```bash
cd /Users/shams/aria-learn/desktop
npm run dist          # build the macOS .dmg (see desktop/README.md)
npm start             # run the packaged stack locally
```
Bundles its own JRE, PostgreSQL and Ollama — see `docs/desktop-architecture.md`.

## Key directories
```
backend/src/main/java/com/mathtutor/
  ai/               GenerationService, AiClient, MathAnswerChecker, AnswerMatcher
  auth/             Parent + Student entities, JWT auth
  practice/         AnswerGrader, practice sessions
  content/          KnowledgeService, ExamplesService
  tutor/            TutorMode, TutorModeService, TutorModeController
  curriculum/       CurriculumService, JSON curriculum files
  mastery/          MasteryService, MasteryRecord

backend/src/main/resources/
  db/migration/     Flyway SQL migrations (current: V24)
  curriculum/       math.json, math-adventures.json, english.json

frontend/src/
  pages/            StudentDashboard, Practice, GuidedPractice, Knowledge, Resources, ChildInsights, ...
  components/       KidHeader, MathManipulative, MathVisual, AdvicePanel, InsightCharts
  lib/              mathProblem.ts, resources.ts, sightWords.ts
  api.ts            All API calls + TypeScript types
  styles.css        All global styles
```

## Architecture notes
- Flyway migrations in `db/migration/` — always add new migrations as V(n+1)__description.sql
- The `desktop` Spring profile changes behaviour meaningfully: it serves the frontend from
  the classpath, denies all CORS, disables Swagger and the demo-account seeder, and refuses
  to start without a per-install `JWT_SECRET`. Keep desktop-only beans behind `@Profile`.
- Migrations must stay PostgreSQL-compatible — the desktop app bundles a real PostgreSQL
  server precisely so partial unique indexes and `TIMESTAMPTZ` keep working
- AI prompts are in `GenerationService.java` — structured JSON output with a repair loop
- `QuestionSanitizer.java` is the structural gate every generated question passes before a child
  sees it: it repairs mechanical defects (options crammed into one string, a key that differs from
  its option only by a label, leaked "(Correct)" markers, options duplicated into the prompt) and
  rejects what stays unanswerable (key naming no option or several at once, duplicate options).
  It is pure and deterministic — no model call — and only ever resolves a key onto an option that
  already exists, so it can fix or drop a question but never give it a wrong answer.
- `MathAnswerChecker.java` does deterministic place-value and plain-arithmetic checking before the
  AI fallback. It defers (returns UNKNOWN) on negated questions ("which is NOT…") and comparative
  ones ("how many times greater… than…"), where solving the phrase would answer a *different*
  question and could overwrite a correct key. Widen its families only with that guard in mind.
- Verification drops broken questions, so `GenerationService.generateQuestions()` regenerates once
  to top the set back up — a child still gets five questions, not three.
- Tutor modes are DB-driven — adding a new mode = one SQL row in `tutor_modes`, zero code changes
- `AnswerMatcher.java` normalizes answer strings. `matches()` is strict; `matchesChoice()` is the
  one to use for multiple choice — it ignores option labels ("B) 19" vs "19") and compares numbers
  by value ("0.50" vs "0.5"), which is what rescues questions already stored with a cosmetically
  different key. All four activities (practice, guided, quiz, homework) grade through it.
- Student pages use `KidHeader` component for consistent fun animated header
- Math manipulatives (drag-and-drop shapes) in `MathManipulative.tsx` — triggered by `parseMathProblem()` for ×/÷ questions

## Common gotchas
- Always `cd backend/` before running `./mvnw` — running from repo root fails
- `position: sticky` on `.topbar` — don't add `position: relative` to child wrappers or it breaks stickiness
- Stored `correct_answer` may carry a label prefix ("B) 19"), be letter-only ("A"), or name no
  option at all. Never compare it to a child's answer with plain string equality — go through
  `AnswerMatcher.matchesChoice()`, and resolve it for display with
  `QuestionSanitizer.resolveKeyToOption()` so the revealed answer is an option the child can see.
- Questions are **never re-served** from `question_bank` — every practice set, guided question,
  quiz, and homework is freshly generated, and the bank is grade-time storage. So a fix to
  generated-question quality must go in the generation path; back-filling old rows changes only
  reports and flagged-question views.
- Test constructor for `GenerationService` needs `mock(TutorModeService.class)` as third argument
- `noUnusedLocals: true` in tsconfig — remove unused imports or build fails

## DB credentials (local dev)
- Host: localhost:5432
- DB: mathtutor
- User: mathtutor
- Password: mathtutor

## Git
- Main branch: `main`
- Remote: origin (GitHub)
- **Never push directly to `main` — always branch, push, and open a PR.** `main` requires a
  pull request with one approving review. Admin pushes are not blocked by it (`enforce_admins`
  is off), so the protection relies on the rule being respected rather than enforced: a direct
  push succeeds and merely reports "Bypassed rule violations". Treat that message as a mistake
  to undo, not a warning to ignore.
- PRs need an approval from the repo owner, so hand the PR over rather than trying to merge it.
- No API keys or secrets should be committed — `.env` is gitignored
