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
- AI prompts are in `GenerationService.java` — structured JSON output with a repair loop
- `MathAnswerChecker.java` does deterministic place-value checking before AI fallback
- Tutor modes are DB-driven — adding a new mode = one SQL row in `tutor_modes`, zero code changes
- `AnswerMatcher.java` normalizes answer strings for MC grading — must strip option labels (A), B., (C), d:)
- Student pages use `KidHeader` component for consistent fun animated header
- Math manipulatives (drag-and-drop shapes) in `MathManipulative.tsx` — triggered by `parseMathProblem()` for ×/÷ questions

## Common gotchas
- Always `cd backend/` before running `./mvnw` — running from repo root fails
- `position: sticky` on `.topbar` — don't add `position: relative` to child wrappers or it breaks stickiness
- MC grading bug (fixed in AnswerMatcher): stored `correct_answer` may have label prefix ("B) 19") or be letter-only ("A") — normalize by stripping labels before comparison
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
- No API keys or secrets should be committed — `.env` is gitignored
