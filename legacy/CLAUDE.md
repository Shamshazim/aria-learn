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
- The desktop app supervises its bundled Ollama: if the engine exits unexpectedly,
  `desktop/src/services/ollama.js` respawns it **on the same port**, with a widening delay. The
  same port is not incidental — the backend is handed `OLLAMA_URL` once in its environment and
  cannot learn a new one, so a restart that moved ports would leave the app just as broken.
  `stop()` sets a flag first so a deliberate shutdown is not mistaken for a crash.
- Beware host-wide `pkill -f "ollama serve"`: it matches the app's *bundled* engine, not just a
  developer's own. The bundled one runs on a private dynamic port, so checking `localhost:11434`
  does not tell you whether the app's engine is alive.
- User-facing AI errors reach the child directly. `OllamaLlmProvider` varies the message by
  profile: under `desktop` it never names Ollama or a model file (a parent cannot act on either),
  and in development it keeps the specific, actionable detail.
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
  It also strips the HTML the model writes — `<br>` between options, `<p>`, `<b>`, `&lt;br&gt;`,
  a double-escaped `\n`. That is load-bearing, not cosmetic: `stripEmbeddedOptions` works line by
  line, so a prompt whose only line breaks were `<br>` used to skip the option-stripping entirely
  and the child read the question, then all four options again, tags and all. Tags are matched by
  name, never as a generic `<…>`, because "is 3 < 5?" is a real prompt.
  It is pure and deterministic — no model call — and only ever resolves a key onto an option that
  already exists, so it can fix or drop a question but never give it a wrong answer.
- A hint is written by a separate call at grade time (`GenerationService.generateHint`) and never
  passes through `sanitize()`, so it goes through `QuestionSanitizer.plainText()` instead — it
  reaches the same screen and the model marks it up the same way.
- `frontend/src/session/text.ts` mirrors that stripping on the display side (`plain`, `promptText`),
  as a second line of defence only: rows generated before the gate existed are still in
  `question_bank`. Fix generated-question quality in the backend; this is the last thing before
  the paint, not the place to add rules.
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
- The child's path is **class list → session**, and the old dashboard moved to
  `/student/dashboard`. `/student` renders `frontend/src/session/SubjectPicker.tsx`: the child's
  enrolled subjects as cards, and picking one navigates to `/student/session?gradeId=…`, which
  renders `session/SessionPage.tsx`. Subject is the *only* choice the child makes — inside the
  session Aria picks the topic, the difficulty and the order, so there is still no topic list, no
  mastery percentage and no six activity links per topic. Everything the child sees in the session
  derives from `useSession.ts`; the three age bands (`band.ts`: early TK–2, middle 3–5, senior 6–8)
  change only CSS tokens, the answer control and the wording, never the teaching rules.
- The picker takes a **grade** id, not a subject id, because that is what `api.progress()` takes:
  one subject at one grade is one curriculum, and a child can sit at different grades in different
  subjects. `apiSession.start()` re-reads the enrolment list to resolve that id, so a stale or
  hand-edited `gradeId` lands on a real class rather than an empty session — and the band comes
  from the *chosen* subject's grade, not from the profile default.
- `session/subjects.ts` maps a subject name to a face and two colours by keyword, so a new subject
  in the curriculum JSON needs no code change to appear on the picker. The rule order matters:
  "English Writing" matches both `writ` and `english`, so writing is tested first. The two colours
  reach the card as the custom properties `--face-tint` and `--face-edge`, which is what lets the
  senior band keep the card white and spend the colour on a 3px edge instead.
- Session data comes through the `SessionSource` contract (`session/types.ts`). `sources/apiSession.ts`
  is the live one and rides on the guided-practice endpoints; `sources/mockSession.ts` is a scripted
  session reachable at `/student/session?demo=1&band=…&subject=…` (or `/student?demo=1&band=…` for
  the picker), for reviewing the UI with the AI engine down. Swapping in a server-side planner
  means replacing `apiSession.ts` and nothing else.
- There is no session chat endpoint yet. "Ask Aria" is answered by `sources/replies.ts::localReply()`
  from the hint and solution the grader already returned. Replace that function body when
  `POST /student/session/ask` exists.
- `session/session.css` prefixes every class `sx-` because the global `styles.css` owns short names
  like `.card`, `.topbar` and `.btn`. Its element reset is wrapped in `:where()` on purpose — written
  as `.sx-app button` it outranks every single-class rule and silently strips button backgrounds.
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
