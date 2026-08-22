# P0-08 — Replace the quiz contract with the event/move protocol

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Frontend |
| **Depends on** | P0-02, P0-06 |
| **Blocks** | P0-09, P0-25, P1-11 |
| **Parallel-safe with** | P0-10 … P0-17 |
| **Size** | L |

## Why

`master-plan.md` §4.1 is explicit: the old `start / answer / hint / next / ask` contract is
shaped like a quiz and cannot express arrival, proactive moves, streaming speech, silence or
interruption. Replacing it while the backend does not exist is deliberate — the protocol gets
proved against scripted scenarios before a model is involved, so a protocol mistake costs a
day instead of a phase.

## Scope

### Build
- A `TutorSource` port in the web app, expressed in the P0-02 protocol: the UI sends
  `TutorInputEvent`s and receives `TutorMove`s.
- A **scripted** source that plays authored scenarios covering every event and move.
- The session state machine (`model/`), framework-free and unit tested, replacing
  `useSession.ts`.
- The thin React hook that binds the state machine to the components.

### Do not build
- No HTTP. The real source is P1-11.
- No audio. Phase 2. `LISTEN` renders its visual state and resolves from a scripted
  transcript.

## Design

```
apps/web/src/features/session/
  model/
    tutor-source.ts        port: send(event) -> AsyncIterable<TutorMove>; close()
    session-machine.ts     pure reducer: (State, TutorMove | UiAction) -> State
    session-state.ts       the State type and selectors
    input-events.ts        builders that produce valid TutorInputEvents
  sources/
    scripted-source.ts     the port, driven by a scenario
    scenarios/
      arrival.ts  first-visit.ts  returning-child.ts  confusion.ts
      interruption.ts  silence.ts  fatigue.ts  ending.ts
  hooks/
    useTutorSession.ts     binds machine + source to React. No decisions in here.
```

Requirements:
- **The state machine is a pure function.** No React, no timers, no fetch. Timers, silence
  detection and speech are effects the hook owns and feeds in as events. This is what makes
  arrival, interruption and silence testable without a browser.
- Every move the machine cannot render is a **typed compile error**, not a runtime fallback.
  Use an exhaustive switch with a `never` guard.
- Interruption is first-class: an `INTERRUPT` event must be able to cancel an in-flight move
  and its speech at any point, and the machine must be provably in a consistent state after.
- `SILENCE` uses an age-appropriate window that comes from the band, not a constant.
- The source is an async iterable so a single event can yield several moves (a `SAY` then an
  `ASK`), and so Phase 2 streaming plugs in without a signature change.
- Scenarios are data, in their own files, and are shared with P0-22's tutoring golden set
  wherever the shapes match.

## Acceptance criteria

- [ ] Nothing in `apps/web` references `SessionSource`, `SessionStep` or `StepResult`.
- [ ] All twelve events can be produced by the UI and all fourteen moves render.
- [ ] Scenario tests, with no browser, cover: arrival before a class is chosen, a welcome
      naming a prior session, a recommendation the child declines, a correct answer, a wrong
      answer then a hint, a second wrong answer then a reteach, "I don't get it", a silence
      timeout, an interruption mid-move, a break, and an ending.
- [ ] The machine's reducer has 100% branch coverage.
- [ ] An interruption during a multi-move response leaves no orphaned state, proven by test.
- [ ] All three band layouts run every scenario end to end in the browser.
- [ ] The P0-07 baseline still passes, or every diff is explained in the PR.

## Verification

```bash
npm run test -w @aria/web
npm run e2e:baseline
npm run dev -w @aria/web   # play each scenario in each band
```

## References

- `master-plan.md` §4.1 — the event and move tables, and the turn loop
- `rewrite.md` §2 ("How to bring it forward", steps 2–4), §5 step 3
