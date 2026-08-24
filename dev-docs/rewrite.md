# The Rewrite — one UI carries forward, everything else starts fresh

Companion to [`master-plan.md`](master-plan.md) (the product) and
[`cloud-model-layer.md`](cloud-model-layer.md) (the model layer). Those two say *what*
Aria must become. This one says what we start from, now that the first version is frozen.

---

## 1. The decision

The first version — Java 21 / Spring Boot backend, Vite frontend, Electron shell with a
bundled JRE, PostgreSQL and Ollama — lives under `legacy/` and is never edited, built, run
or imported from. The new product is:

| Layer | Stack |
|---|---|
| Frontend | React + TypeScript + Vite |
| Backend | Node + Express + TypeScript |
| Database | PostgreSQL |
| Models | Hosted only. No Ollama, no local weights, no offline mode. |

This is a rewrite, not a port. The authority order is:

1. The required tutor behaviour in [`master-plan.md`](master-plan.md).
2. The stack and delivery decisions in this document and
   [`cloud-model-layer.md`](cloud-model-layer.md).
3. The existing student session UI as a changeable design starting point.
4. Everything else under `legacy/`, which is historical evidence and optional inspiration.

Legacy code never wins a disagreement with the new product requirements.

---

## 2. The one thing that carries forward: the student session UI

`legacy/frontend/src/session/` is already React + TypeScript. It is the only implementation
that carries forward, because its age-band design, simplicity and class-first entry were
created deliberately for the new child experience. Bring it into the new frontend as the
visual and experiential starting point.

"Carries forward" does **not** mean frozen. We do not redraw it without reason, but its
components, controls, layout, state machine and API contract may change whenever the tutor
behaviour in `master-plan.md` requires it.

### What it is — four screens

| Screen | File | What it does |
|---|---|---|
| Class picker | `SubjectPicker.tsx` | The child's front door. The one choice they make. |
| Session — early (TK–2) | `layouts/EarlyLayout.tsx` | Owl, speech bubble, huge tap tiles, star jar. Almost no text. |
| Session — middle (3–5) | `layouts/MiddleLayout.tsx` | Text and picture together, progress dots, Ask Aria. |
| Session — senior (6–8) | `layouts/SeniorLayout.tsx` | Quiet and adult. No owl. Segmented bar, work pad. |

`SessionPage.tsx` picks the layout from `bandForGrade()` in `band.ts`. Around them sit
fifteen components (`components/`), `session.css`, and the shared vocabulary in
`types.ts`, `subjects.ts` and `text.ts`.

### What survives and what does not

Preserve by default:

- The class picker as the child's one meaningful choice.
- The distinct early, middle and senior visual languages.
- One focused stage rather than a child-facing dashboard or topic menu.
- Large, accessible controls and the existing design tokens where they still work.
- Aria's visual presence for younger children and the quieter senior treatment.

Replace or change as required:

- The old `start/answer/hint/next/ask` `SessionSource` contract. It is shaped like a quiz and
  cannot express arrival, proactive moves, streaming speech, silence or interruption.
- The fixed `SessionStep`/`StepResult` state machine and hard-coded two-attempt policy.
- Browser speech as the primary voice system.
- The separate "Ask Aria" interaction if the live conversation makes it redundant.
- Any component that cannot render the new event/move protocol or multimodal content.

### How to bring it forward

Move the UI into `apps/web` in a reviewable commit so its visual baseline can be compared in
all three bands. Then replace the behaviour beneath it before connecting a real backend:

1. Keep a screenshot or visual test of the existing class picker and three layouts.
2. Define new shared `TutorInputEvent` and `TutorMove` unions from `master-plan.md` §4.1.
3. Drive arrival, welcome, recommendation, conversation, listening, interruption and ending
   through a new scripted tutor source.
4. Refactor or replace components until every required move renders accessibly in each band.
5. Connect the same protocol to the real backend in Phase 1 and live voice in Phase 2.

The old mock content can inspire the new scripted scenarios, but it is not copied as the new
contract. The regex reply system, old API session source and old voice plumbing do not carry
forward.

---

## 3. How legacy material may be used

Nothing else is reimplemented by translation. Engineers may inspect legacy material when it
answers a specific question or supplies a real defect case. They then design the new module
from the current requirements.

| Legacy source | Permitted use |
|---|---|
| `QuestionSanitizer.java` | Seed regression cases for structural failures found previously. |
| `AnswerMatcher.java` | Seed comparison edge cases for new tests. |
| `MathAnswerChecker.java` | Seed accepted and deliberately refused arithmetic examples. |
| `db/migration/V1..V24` | Historical evidence when designing new tables; never a schema to continue. |
| `resources/curriculum/*.json` | Reference during authoring and review of the new skill graph; never assumed correct or moved automatically. |

Auth, enrolment, memory, curriculum, quality gates, generation, prompts, voice, progress,
reporting and the runtime are all built fresh. Copying a legacy module requires a new owner
decision recorded in these documents; there are no implied exceptions.

---

## 4. Repo layout — proposed, not yet built

```
apps/
  web/        React + TypeScript + Vite. The carried-forward session UI starts here.
  api/        Node + Express + TypeScript.
packages/
  shared/     TutorInputEvent, TutorMove, Band and other shared protocol types.
dev-docs/     These plans.
legacy/       Frozen. Reference only.
```

npm workspaces. `packages/shared` holds the new protocol defined from `master-plan.md`; no
legacy UI type becomes an API contract merely because it already exists.

Migrations run from `apps/api`, numbered from `001`. PostgreSQL only — the old plan's
partial unique indexes and `TIMESTAMPTZ` assumptions still hold.

---

## 5. Order of work

1. **Scaffold** the workspace, TypeScript config, lint and `.env.example`.
2. **Bring the session UI forward** and capture its visual baseline in all three bands.
3. **Define the new shared event/move protocol** and run the UI against scripted arrival,
   tutoring, voice-state and interruption scenarios. Change components as required.
4. **Build the model layer and both golden sets** — content plus multi-turn tutoring — with
   retry, fallback, cost accounting, streaming capability and a small verified cache.
5. **Build Phase 1 of `master-plan.md`**: proactive text-first arrival, minimal supported
   memory and skill state, and the real tutor loop.
6. Continue through real-time voice, durable relationship memory, teaching and scale in the
   phase order of `master-plan.md` §13.

Only the visual starting point in step 2 is carried-forward product work. Every behavioural
contract from step 3 onward is new product.

---

## 6. Open questions this rewrite reopens

| Question | Why it matters now |
|---|---|
| Does the desktop app survive? | Cloud-only removed the offline-with-no-account argument. A web app may be the right shape. Nothing in `legacy/desktop/` is being ported until this is answered. |
| Auth: build it ourselves or use a hosted identity provider? | **Closed by P0-26:** buy managed Supabase Auth for adults only. Child profiles and every child identifier remain in Aria. |
| Does the authored curriculum live in versioned files, the database, or both? | `master-plan.md` §4.4 requires a reviewable skill graph and runtime queries; storage must support both without making legacy JSON authoritative. |

### Identity decision (P0-26)

Aria will use **managed Supabase Auth for parent and teacher identities**, behind an
Aria-owned identity port. We will not build password storage, recovery, token rotation or
breach controls. Children are not identity-provider users: a child profile is an Aria row
owned by a consenting adult and contains only the nickname and learning facts Aria needs.

This choice keeps the sensitive boundary narrow. Supabase receives an adult email and its
own opaque subject; it receives no child name, grade, class, transcript or learner memory.
Aria remains the controller and Supabase is a contracted processor under its
[DPA](https://supabase.com/downloads/docs/Supabase%2BDPA%2B260317.pdf). The Auth server is
open source and can be [self-hosted](https://supabase.com/docs/reference/self-hosting-auth)
if residency or contract requirements later demand it, which gives this decision a credible
exit without making self-hosting today's operational burden.

Parents enter through an email magic link. On a shared device, the parent authorises that
device and chooses which child profiles it may open. A child then starts by tapping their
recognisable picture and a four-picture secret; no reading, email or keyboard is required.
That device grant can reach only the selected child's session APIs. Parent pages always
require the adult session, and sensitive parent actions require a fresh adult verification.
The same server contracts work in a web app and in a possible desktop shell; only cookie
storage changes to an operating-system credential store.

The parent creates and owns every child profile. A teacher is a separate adult identity.
A class link becomes active only after the parent approves it, or after an authorised school
or district supplies consent; an individual teacher account is not silently treated as
parental consent. Class membership and permissions live in Aria, not in identity-provider
metadata.

Before any child data is collected, signup asks whether the visitor is an adult parent,
guardian or authorised educator. A child who answers no is stopped and told to get an adult;
no account or persistent identifier is created. For family purchases, the parent receives
the direct privacy notice and gives verifiable consent during the monetary transaction. A
non-paid path must use another FTC-accepted verification method before opening a child
profile. This implements the FTC's requirements for prior verifiable consent, parental
access, deletion, minimisation and retention in the current
[COPPA guidance](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).
Aria uses parent consent for every minor rather than trying to exploit the varying 13–16
thresholds under [GDPR Article 8 guidance](https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf),
and applies the UK's [Age Appropriate Design Code](https://ico.org.uk/media/for-organisations/guide-to-data-protection/ico-codes-of-practice/age-appropriate-design-a-code-of-practice-for-online-services-2-1.pdf).
There is no child email, child-directed marketing, advertising or sale of data.

Adult access tokens expire after 15 minutes. Refresh tokens rotate on use; adult sessions
time-box at 30 days and expire after 7 days of inactivity. A child session expires after 30
minutes idle or four hours total and locks on profile switch. Parents can list and revoke
devices. Account deletion first revokes Aria device and server sessions, deletes Aria data,
then hard-deletes the adult Auth user. Aria rejects a deleted parent even if a previously
issued JWT has not yet expired; Supabase documents that hard deletion removes sessions and
refresh tokens but an access JWT remains valid until expiry, so deletion cannot rely on JWT
expiry alone ([deletion behavior](https://supabase.com/docs/guides/auth/managing-user-data#deleting-users)).
Restores must replay the deletion ledger, and inaccessible backups age out on their declared
retention schedule.

The production estimate is **$25/month at 1,000 children** and **$25/month at 100,000
children**, assuming roughly 750 and 75,000 monthly active adult accounts respectively.
Supabase Pro currently includes 100,000 MAU and charges $0.00325 for each additional MAU
([pricing](https://supabase.com/pricing)); a conservative 105,000-adult month would be
$41.25. Transactional email is budgeted separately from identity. Clerk would be roughly
$1,025 at 100,000 retained adults under its current published tiers, while WorkOS AuthKit is
currently free below one million MAU; Supabase still wins because Aria gets an open-source,
exportable auth store and a self-host exit rather than making a proprietary hosted user
directory the only authority.
