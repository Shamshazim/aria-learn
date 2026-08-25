# X-03 — Device and accessibility matrix

| | |
|---|---|
| **Phase** | Cross-cutting (must pass before Phase 2H exit) |
| **Track** | Frontend |
| **Depends on** | P2-06, P2-07, P2-08, P0-07 |
| **Blocks** | P2H-14, P4-08 |
| **Parallel-safe with** | all Backend tickets |
| **Size** | M |

## Why

A five-year-old uses an iPad in Safari, a third-grader a school Chromebook, a family a
cheap Android tablet. Each has different autoplay, microphone, WebRTC and echo-cancellation
behaviour, and `master-plan.md` §4.7 makes every one of those a product feature, not
onboarding cleanup. The visual baseline (P0-07) runs on desktop Chromium only. A voice
tutor that works in the developer's browser and not on the child's tablet has not shipped.

## Scope

### Build
A supported-device matrix, per-device automated checks where a real browser can be driven,
a manual test script for the rest, accessibility conformance (WCAG 2.2 AA for the middle
and senior bands; the early band is voice-first and is judged by its own checklist), and
fixes for every failure found.

### Do not build
No native apps. No support for browsers that cannot do WebRTC + getUserMedia (they get the
text/tap fallback from P2-07 and a plain sentence). No camera use of any kind.

## Design

```
dev-docs/qa/device-matrix.md
  Tier 1 (must pass every release): iPad Safari (current and previous iOS), Chromebook
    Chrome, Android tablet Chrome, macOS Safari, Windows Chrome/Edge.
  Tier 2 (must degrade to text/tap cleanly): Firefox desktop, Samsung Internet, older
    iOS Safari.
  Per device: autoplay outcome, mic permission flow, echo cancellation, barge-in silence
    p95, captions, orientation, tap target size, zoom 200%.
apps/web/e2e/
  devices/*.spec.ts           Playwright device descriptors for WebKit/iPad, Chromium/
                              Chromebook, Android; runs the arrival → speak → interrupt →
                              answer path with a fake media stream
  a11y/*.spec.ts              axe-core on every band's four screens; contrast, names,
                              focus order, reduced motion
  manual/voice-device-script.md  the human checklist (real mic, real speaker, a child-height
                              table) with a results table per device
apps/web/src/features/voice/
  hooks/useDeviceCapabilities.ts   feature detection: getUserMedia, AudioContext resume,
                              autoplay probe (P2-08), echoCancellation constraint support,
                              orientation lock; exposes a typed capability set
  components/DeviceFallback.tsx    the one calm screen for "this device cannot do voice
                              right now" that offers text/tap
apps/web/src/styles/
  targets.css                 minimum 48×48 CSS px tap targets in early band, 44 in others;
                              `prefers-reduced-motion` honoured everywhere
```

Accessibility rules:
- Every spoken move has visible captions (P2-07) and is announced to a screen reader via a
  polite live region; the early band's picture answers carry alt text with the spoken word.
- Focus order follows reading order; the visible stop button (P2-06) is always reachable by
  keyboard and is the first tab stop while Aria speaks.
- Colour is never the only carrier of right/wrong.
- No motion that cannot be turned off; no flashing above 3 Hz.

### Edge cases
- iOS Safari suspends `AudioContext` on backgrounding: resume on `visibilitychange`; if
  resume fails, show the visible-welcome path and unlock on the next natural tap (P2-08),
  never a "tap Aria" demand.
- iPad with a Bluetooth speaker: echo cancellation may not apply; measure barge-in false
  positives and, above threshold, fall back to push-to-talk with a clear label.
- Chromebook managed policy blocks the mic: permission returns `denied` permanently; the
  device fallback screen explains it in parent language and offers text/tap.
- Orientation change mid-session: layout reflows with no lost state; the session machine is
  not remounted.
- 200% zoom / large text: no clipped controls; tested by axe + a viewport at 320 CSS px.
- Screen reader user in the senior band: captions region announces only new sentences, not
  the whole transcript on every update.
- Low-end laptop CPU: local VAD (P2-06) drops frames; the client reports `vad_dropped` and
  the server-confirmed interrupt path still works, tested with CPU throttling in Playwright.

## Acceptance criteria

- [ ] `device-matrix.md` lists every Tier 1 and Tier 2 device with its expected behaviour.
- [ ] Device e2e specs run in CI for WebKit, Chromium and an Android descriptor, each
      completing arrival → speech → interrupt → answer with a fake stream.
- [ ] axe-core reports zero serious/critical violations on all twelve band screens.
- [ ] Manual script completed on real Tier 1 hardware with results recorded in the PR; every
      failure has a linked fix or ticket.
- [ ] Autoplay-blocked, mic-denied and no-WebRTC each reach the fallback screen with no
      demand to click Aria.
- [ ] Tap targets meet the size rule in every band, asserted by a test.
- [ ] `prefers-reduced-motion` disables every non-essential animation.
- [ ] Barge-in silence p95 < 250ms on each Tier 1 device in the manual run.

## Verification

```bash
npm run e2e -w @aria/web -- devices a11y
npm run e2e:baseline -w @aria/web
```

## References

- `master-plan.md` §4.7 (browser reality), §5
- `realtime-agent-harness.md` — barge-in, autoplay sections
- P0-07, P2-06, P2-07, P2-08
