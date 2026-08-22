# P1-12 — Arrival in the UI: Aria greets first

| | |
|---|---|
| **Phase** | 1 |
| **Track** | Frontend |
| **Depends on** | P0-09, P1-04 |
| **Blocks** | P1-15 |
| **Parallel-safe with** | P1-11, P1-13 |
| **Size** | M |

## Why

The class picker is the child's front door, and today it is a silent menu. `master-plan.md`
§4.1 puts the relationship **before** the choice: Aria is present when the child arrives,
greets them, and may recommend something — and the child still picks. This is the single most
visible change in Phase 1.

## Scope

### Build
The arrival flow on the home screen: fire `ARRIVED`, render `WELCOME` and `CHECK_IN`, show a
`RECOMMEND` next to the class picker, and carry the choice into the session.

### Do not build
No spoken welcome. Phase 2. The visual welcome must already be structured so speech can be
added without a redesign.

## Design

```
apps/web/src/pages/HomePage.tsx           becomes the arrival screen
apps/web/src/features/arrival/
  components/WelcomeBanner.tsx
  components/CheckInPrompt.tsx
  components/RecommendationCard.tsx        sits beside the picker, never replaces it
  model/arrival.machine.ts                 pure; same pattern as the session machine
  api/arrival.api.ts
```

Rules:
- **The child still makes exactly one choice: which class.** The recommendation is an option
  presented alongside the picker, never a modal, never a default that must be dismissed.
- Declining the recommendation is normal. Nothing in the UI treats it as a wrong answer.
- The visible welcome must render **within 500ms at p95** (`master-plan.md` §11). It is
  template-composed server-side and needs no model, so the UI must not add a blocking call in
  front of it.
- The check-in accepts an answer ("tired", "ready for a challenge") and carries it into the
  session as context.
- Early band: the welcome is large, pictorial and readable-by-not-reading. Senior band: quiet,
  short, no owl.
- Autoplay reality (`master-plan.md` §4.7): the welcome appears visually immediately;
  Phase 2 adds speech on the child's natural class selection. **Never** a "press Aria's face"
  requirement — do not build an affordance now that Phase 2 would have to remove.

## Acceptance criteria

- [ ] Opening the app fires `ARRIVED` and renders `WELCOME` + `CHECK_IN` before any choice.
- [ ] Visible welcome at p95 under 500ms, measured in an e2e timing test.
- [ ] The recommendation appears beside the picker; choosing another class works and is
      recorded as declined, with no change in tone.
- [ ] The check-in answer reaches the session as context, proven end to end.
- [ ] All three bands render arrival appropriately; axe passes on each.
- [ ] Nothing in the UI asks the child to press Aria to make her speak.
- [ ] The baseline snapshots are updated and the change is explained in the PR.

## Verification

```bash
npm run e2e -- arrival
npm run e2e:baseline
```

## References

- `master-plan.md` §4.1, §4.7, §5, §11
