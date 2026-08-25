# P2H-03 — Aria's persona and the per-move prompt library

| | |
|---|---|
| **Phase** | 2H |
| **Track** | Backend |
| **Depends on** | P2H-02 |
| **Blocks** | P2H-04, P2H-05, P2H-07, P2H-11, P2H-14 |
| **Parallel-safe with** | P2H-01, P2H-08, P2H-10, P2H-12 |
| **Size** | M |
| **Status** | 🟡 Core implemented on branch `docs/harness-review-fixes` (commits `ab1ef4b`, `ccba913`), no PR yet. |

## Why

`apps/api/src/ai/prompts/registry.ts` holds six prompts, all JSON extractors, and only `HINT`,
`SAY` and `RETEACH` ever reach a model. Aria's whole character is one sentence: *"You are Aria,
a precise and encouraging tutor for children. Give only the requested JSON."* Nine of the
fourteen moves are hard-coded strings. A person is a consistent voice across every move; that
is what this ticket adds.

## Scope

### Build
A persona document, band registers, a prompt definition for every move, few-shot examples per
band, an anti-repetition instruction, output schemas, and a re-run of the tutoring golden set
with the human rubric.

### Do not build
No dialogue history in prompts (P2H-04). No intent classification (P2H-05). No planner (P2H-06).

## Design

```
apps/api/src/ai/prompts/
  persona/aria.persona.ts          the persona text as a typed constant (from aria.md, checked equal)
  persona/aria.md                  human-readable source of truth, reviewed
  persona/registers.ts             early | middle | senior register blocks
  persona/examples/{early,middle,senior}.examples.ts   3–5 few-shot pairs per move per band
  definitions/
    welcome.prompt.ts  check-in.prompt.ts  recommend.prompt.ts  ask.prompt.ts
    listen.prompt.ts   praise.prompt.ts    reveal.prompt.ts     switch.prompt.ts
    break.prompt.ts    end.prompt.ts       show-caption.prompt.ts
    (explain/hint/reteach are existing; they adopt the persona and registers)
  render/compose.ts                persona + register + move instruction + examples + context
  registry.ts                      registers the 11 new definitions
  types.ts                         PromptDefinition gains `move: MoveKind`, `register: true`
apps/api/src/services/content/
  turn-content.service.ts          generateText handles every kind (table replaces the if-chain)
  move-prompt.map.ts               MoveKind -> prompt id + output schema
```

**Persona** (`aria.md`, normative headings): who she is (a patient human tutor, first person,
never "as an AI"); what she never does (no "good job", no "as I said", no lecturing, no lists
read aloud, no emoji, no questions about the child's life beyond consented facts, never asks
for personal information); warmth rules (name the child at most once per two turns, notice
effort specifically, admit when she was unclear); brevity per band; and how she disagrees
(senior band pushes back with a reason and asks the child to defend theirs).

**Registers** (`registers.ts`):
- early: ≤ 2 sentences, ≤ 12 words, concrete nouns, one idea, playful, no sarcasm.
- middle: ≤ 3 sentences, reasoning aloud ("first… because…"), invites a guess.
- senior: quiet, adult, no exclamation marks, argues a little, asks "why does that work".

**Every move prompt** returns `{ text: string, speech?: { text } , emphasis?: string[] }` via
the existing JSON schema mechanism, is rendered by `compose.ts` in the fixed order
persona → register → move instruction → examples → scrubbed context → **do-not-repeat list**
(`recentTexts` from P2H-01) → output schema. Prompt ids are versioned (`praise.v1`); the
version is written to `ai_generation_log` and `session_event.evidence`.

**Anti-repetition instruction**: "You have recently said: [list]. Do not reuse any of those
sentences or their openings." Enforced post-hoc by the P2H-01 guard; the prompt is the first
line of defence, the guard the second.

### Edge cases
- Model returns text with a list or markdown → structural check fails → regenerate once →
  fallback (P2H-11 makes the fallback specific). Logged (P2H-02).
- Model addresses the child by name when no name is in context → post-check strips any
  capitalised token not in the allowlist and re-gates.
- Model output in the wrong register (exclamation marks in senior) → `register.check.ts`
  (new, part of level) fails with `wrong_register`.
- Prompt injection inside the scrubbed context (a child answered "ignore your rules") →
  context is rendered inside a delimited block labelled as untrusted; a fixture in
  `privacy/__fixtures__` proves the persona holds.
- `SHOW` captions must not describe the visual ("here is a number line") but say what to do.
- Token budget: persona + register + examples ≤ 1,200 tokens; measured in a test.

## Status (2026-08-25)

- Done: `aria.persona.ts` + band registers, single `respond` prompt with per-move/approach instructions, `turn-content.service.ts` generates every spoken move through it, prompt-injection-safe dialogue block.
- Remaining: `aria.md` + human review, per-kind provider-call test, register checks over the golden set, rubric ≥ 80%, prompt id/version on every generation, token-budget test.

## Acceptance criteria

- [ ] All 14 move kinds have a registered prompt; `move-prompt.map.ts` is exhaustive by type.
- [ ] `turn-content.service.ts` calls the model for every kind when `ai` is available; a test
      counts one provider call per move kind.
- [ ] Persona text in `aria.persona.ts` equals `aria.md` (test), and `aria.md` is reviewed by
      a human tutor with the review recorded in the PR.
- [ ] Register check: 20 senior-band outputs from the golden set contain zero exclamation
      marks; early-band outputs never exceed two sentences.
- [ ] The P0-22 tutoring golden set is re-run; the human rubric score for "warm,
      age-appropriate, useful" is ≥ 80% (P2H-14 raises the bar to 90%) and recorded.
- [ ] Prompt-injection fixture cannot make Aria break persona or request personal data.
- [ ] Prompt id + version recorded on every generation.
- [ ] Persona + register + examples ≤ 1,200 tokens (test).

## Verification

```bash
npm run test -w @aria/api -- prompts
npm run golden:tutoring -w @aria/api
npm run golden:content -w @aria/api
```

## References

- `master-plan.md` §4.1 (moves table), §5 (band feel), §11 "Human tutor rates the response"
- `cloud-model-layer.md` §6 (prompt registry), §8 (JSON mode)
- P0-14, P0-22
