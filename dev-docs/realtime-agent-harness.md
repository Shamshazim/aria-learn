# Realtime agent harness for Aria — architecture brief

**Status:** research draft. Written 2026-08-22.  
**Companions:** [`master-plan.md`](master-plan.md) (presence + tutor loop, voice §4.7, Phase 0→2), [`rewrite.md`](rewrite.md) (Node + Express + TypeScript), [`cloud-model-layer.md`](cloud-model-layer.md) (provider ports, gating, speech open question).

This document compares approaches for a product-owned realtime agent harness with voice. It does not pick final speech vendors — Phase 0 locks interfaces; Phase 2 chooses providers from measured latency, interruption, accuracy, safety and cost.

---

## What the harness must be

In this plan, a **harness** is not “call an LLM.” It is the **controlled turn loop** that:

1. Loads session + relevant memory + skill state
2. Runs **deterministic policy first** (safety, limits, due skills, known fixes)
3. Asks a planner only when judgement is needed
4. Fetches or generates content, then runs the **quality gate**
5. Writes `session_event`
6. Emits a **move** (`WELCOME`, `ASK`, `HINT`, `LISTEN`, …) over text **or** live voice

Voice requirements that force architecture choices:

| Requirement | Implication |
|---|---|
| Live, interruptible conversation | Duplex audio + barge-in cancel of Aria speech in **&lt; 250 ms** |
| Product owns the protocol | Browser talks to **Aria events/moves**, not vendor Realtime schemas |
| Sentence-sized gating | Raw model audio/tokens must **not** go straight to the child |
| Oral reading assessment | Need word-level transcripts + timing (WCPM, missed words → phonics) |
| Autoplay / mic reality | Welcome can be visual-first; audio unlocks on a natural action |

So: **transport**, **turn-taking**, and **tutor brain** must be separable. Mixing them into one vendor speech-to-speech session fights the quality gate and the event/move contract.

---

## The two industry patterns (and why Aria is a hybrid)

Current practice (OpenAI, LiveKit, Pipecat, production voice systems) converges on:

### A. Speech-to-speech (S2S)

One model: audio in → audio out (OpenAI Realtime, Gemini Live).

**Pros:** ~150–300 ms, natural barge-in, simplest demo.  
**Cons:** Hard to inspect; weak fit for “deterministic policy + quality gate before the child hears it”; vendor lock-in; child-facing audio bypasses Aria’s gate unless you add a mediation layer anyway.

### B. Cascade (STT → LLM → TTS)

You own each stage.

**Pros:** Full control, durable transcripts, swap providers, gate text before TTS.  
**Cons:** Typical 400–800 ms; more moving parts; barge-in must be built (cancel LLM + TTS mid-flight).

### C. Half-cascade (recommended middle)

Realtime model (or streaming STT) for **understanding** + your **text tutor loop** + streaming TTS you control. Or: S2S for low-latency *prosody*, but **tools / moves / gated SAY text** still go through Aria.

OpenAI’s own docs frame the same fork: **RealtimeAgent** for natural S2S vs **chained VoicePipeline** when you need control over intermediate text. Aria’s rules (gate, policy, `session_event`) push toward **chained / half-cascade with a product-owned session**.

---

## Transport options (browser ↔ Aria)

Master plan: **WebRTC preferred**; WebSocket OK for events / fallback.

| Option | Shape | Fits Aria? |
|---|---|---|
| **1. Browser ↔ vendor WebRTC** (ephemeral key from Express) | Express only mints session; audio never hits your server | Fastest demo; **bad** for gate, audit, memory, cost caps, scrubbed prompts |
| **2. Browser ↔ Express WebSocket (PCM)** | Mic frames to Node; Node runs STT/LLM/TTS | Full control; Express alone is awkward for media (NAT, AEC, reconnect); higher latency |
| **3. Browser ↔ WebRTC SFU (LiveKit / similar) ↔ Node agent** | Child is a WebRTC participant; your agent joins the room | **Best production fit**: low-latency media, barge-in, reconnect; Node owns tools + policy |
| **4. Hybrid** | WebRTC for audio; WebSocket/SSE for Aria **moves** (`SHOW`, captions, silence UI) | Matches UI that must show visuals + captions + listening state |

**Recommendation:** Option **3 + 4**. Express stays the **HTTP control plane** (`POST .../realtime` negotiates credentials / room). A **long-lived Node voice worker** (same monorepo, not necessarily inside the Express request path) owns the live session. That mirrors how LiveKit Agents and production OpenAI setups actually scale: HTTP mint → media plane → agent runtime.

```
Browser (session UI)
   │  WebRTC audio (+ data channel for moves)
   ▼
Media SFU (LiveKit Cloud or self-host)
   │
   ▼
Node voice worker  ←→  Express APIs / Postgres
   │                      (arrival, session, memory, quality gate)
   ├── STT / realtime-understand port
   ├── TutorHarness (policy → planner → tools → gate)
   └── TTS / speech-asset cache port
```

Express responsibilities stay aligned with the Phase 0 tickets: auth, negotiate live session, persist events, cost caps. It should **not** try to be a media server.

---

## Harness shape inside Node

Treat the harness as a **state machine + ports**, not a single chat completion.

### Session states (voice-aware)

`IDLE → LISTENING → THINKING → SPEAKING` (+ `PAUSED`, `ENDED`)

Events from the media plane map to master-plan events:

| Media / UX signal | Tutor event |
|---|---|
| Child joins / home active | `ARRIVED` |
| VAD speech start while Aria speaks | `INTERRUPT` → cancel TTS immediately |
| Partial ASR | `SPEECH_PARTIAL` |
| End-of-turn (semantic VAD / turn detector) | `SPEECH_FINAL` / `ANSWER` / `QUESTION` |
| Timeout by age band | `SILENCE` |
| Class pick | `SUBJECT_CHOSEN` |

Moves out are **structured** (`type`, `text`, `show`, `listenMode`, …). TTS is a **renderer** of moves that are speakable — same as the UI is a renderer of `SHOW` / `ASK`.

### Critical ports (Phase 0 interfaces, Phase 2 providers)

Aligned with `cloud-model-layer.md` open question on speech providers:

| Port | Job |
|---|---|
| `LiveSessionTransport` | Negotiate + attach duplex audio; emit VAD/interrupt |
| `SpeechToText` | Streaming partials + finals; **word timestamps** for `LISTEN` |
| `TutorHarness` | Policy → planner → tools → gate → move |
| `TextToSpeech` | Stream sentence chunks; **abort()** for barge-in |
| `SpeechAssetCache` | Hash → reusable audio (`speech_asset`) |
| `OralReadingAssessor` | Align transcript to passage → WCPM, misses, phonics patterns |

Do **not** expose OpenAI Realtime event names or Gemini Live schemas to the React app. The app only knows Aria events/moves (shared tutor protocol).

---

## Framework options (what to buy vs build)

| Stack | Language | Strength | Risk for Aria |
|---|---|---|---|
| **LiveKit Agents (`@livekit/agents`)** | Node + Python | WebRTC, Silero VAD, semantic turn detection, adaptive barge-in, tool hooks, reconnect | Another infra dependency; keep Aria protocol above it |
| **Pipecat** | Mostly Python | Excellent pipeline / Smart Turn; strong telephony story | Stack split vs Express/TS rewrite |
| **OpenAI Agents Realtime (`RealtimeAgent`)** | JS | Fastest S2S; WebRTC helpers | Tempting to skip gate; vendor protocol leaks into product |
| **LLMRTC / custom duplex orchestrator** | TypeScript | Own the orchestrator; pluggable STT/LLM/TTS | You rebuild turn-taking and media resilience |
| **Vapi / Retell** | Hosted | Ship phone agents fast | Wrong product shape (call-center); weak for multimodal `SHOW` + child UI |

**Practical pick for Aria:**

1. **Phase 1:** Express HTTP tutor loop only (`/arrival`, `/session`, `/turn`) — no live audio. Scripted + real text moves.
2. **Phase 2:** Add **LiveKit (or equivalent SFU) + Node agent worker** as the media harness; Aria `TutorHarness` remains the brain.
3. Use OpenAI Realtime / Gemini Live **only behind** `SpeechToText` / optional `RealtimeUnderstand` ports — never as the browser’s public API.

If you want one TypeScript-native path with less LiveKit, a **custom duplex orchestrator** (VAD → STT → LLM → TTS with `AbortController` barge-in) works, but you will re-implement ICE/TURN, echo cancellation, and reconnect that LiveKit already solved. For a five-year-old on flaky home Wi‑Fi, that cost is real.

---

## Voice-specific design notes

### Barge-in (&lt; 250 ms)

Industry pattern: on confirmed interrupt → **abort TTS stream + abort in-flight LLM**, duck/stop playback on the client immediately. Prefer **adaptive interruption** (distinguish “mm-hm” from true barge-in) for early band — LiveKit and Pipecat both invest here. Pure energy VAD alone will cut Aria off mid-praise.

### End-of-turn

Silence thresholds alone are wrong for kids (slow readers, long pauses). Prefer:

- VAD for start
- **Semantic / model turn detection** for stop
- Age-band endpointing (`minDelay` / `maxDelay` shorter for early band)

Master-plan bar: ≥ 98% correct end-of-turn on a voice test set — budget a golden audio set in Phase 2, not anecdotes.

### Gating vs latency

S2S wants to speak immediately; Aria forbids raw tokens to the child. Compromise:

- **Cached / template moves** (`WELCOME`, common `HINT`s): speak from `speech_asset` with near-zero generation
- **Generated teaching:** stream **sentence segments** through the gate, then TTS chunk-by-chunk (first audible &lt; 1 s after activation for welcome)
- **Arithmetic / MC content:** buffer whole item until checker passes — never speak a wrong sum

This is why half-cascade fits better than pure S2S for a tutor that “must never be wrong about the subject.”

### Oral reading (`LISTEN`)

Do not use generic chat STT alone. Pipeline:

1. Known passage text (from verified content)
2. Streaming ASR with **word timestamps** (Deepgram, Whisper-timestamped-style, or child-speech-tuned vendors)
3. Align hypothesis → prompt (classic ORF literature: WCPM from correct words / on-task duration)
4. Map misses → phonics patterns → `skill_state`

Capture timing events in Phase 2 even before full phonics curriculum (master plan already says this).

### Browser autoplay / permissions

Harness must emit moves that the UI can play **when** audio is unlocked; never block the session on `say` failing. Mic sound-check, device recovery, captions, mute, text/tap fallback are part of the live session state machine.

---

## How this maps to the API surface

```
POST /api/v1/student/session/{id}/realtime   → mint room/token + short-lived live credentials
WS/WebRTC .../live                           → duplex audio + move/event channel
POST /api/v1/student/session/turn            → text / non-realtime fallback (same harness, no media)
```

Same **`TutorHarness.handle(event) → Move[]`** for both paths. Voice is a **transport adapter**, not a second brain. That is what keeps Phase 1→2 incremental and keeps parent transcripts / golden tutoring scenarios coherent.

---

## Recommended option (summary)

| Layer | Choice |
|---|---|
| Control plane | Express + TypeScript (as in rewrite / API skeleton) |
| Tutor brain | Product-owned harness: policy → planner → tools → quality gate → moves |
| Media plane | WebRTC via SFU (LiveKit strongly indicated) + Node agent worker |
| Understanding | Streaming STT port first; optional realtime multimodal behind the same port |
| Speaking | Streaming TTS + `speech_asset` cache; hard `abort()` on `INTERRUPT` |
| Child protocol | Only Aria events/moves — never vendor realtime wire formats |
| Anti-pattern | Browser ↔ OpenAI/Gemini WebRTC with the model as the tutor |

**Why this wins against the plan:** preserves “product owns the protocol,” satisfies interruption and oral-reading needs, keeps the quality gate on the critical path, and lets Phase 1 ship text while Phase 2 plugs in live audio without rewriting the UI contract.

---

## What Phase 0 should lock now (before picking vendors)

1. Shared **event/move** types including `SPEECH_*`, `INTERRUPT`, `SILENCE`, `LISTEN`
2. Ports above (even with stub / scripted implementations)
3. Rule: child-facing release = gated sentence or verified asset only
4. Latency SLOs from master-plan §11 as harness acceptance tests
5. Decision record: SFU-backed WebRTC vs raw WS — default **SFU** unless you explicitly accept rebuilding media

Provider choice (OpenAI Realtime vs Gemini Live vs Deepgram + Cartesia/ElevenLabs) stays a **measured Phase 2** decision, as `cloud-model-layer.md` already says.

---

## Research references (2025–2026)

- [OpenAI Voice agents](https://developers.openai.com/api/docs/guides/voice-agents) — S2S vs chained pipeline
- [OpenAI Realtime WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc) — Express ephemeral session pattern
- [LiveKit turn detection & interruptions](https://livekit.com/blog/turn-detection-and-interruption-handling) — VAD, semantic EOU, adaptive barge-in (Node SDK)
- [Pipecat speech input & turn events](https://docs.pipecat.ai/pipecat/learn/speech-input) — Silero VAD + Smart Turn
- WebRTC vs WebSocket for voice agents — hybrid SFU + server-mediated model leg is the common production pattern
- Oral reading / WCPM automation — ASR + prompt alignment; word timestamps required for fluency metrics

---

## Suggested next doc

A short **Phase 2 live session design**: interfaces + sequence diagrams for `ARRIVED` → spoken welcome → barge-in → `LISTEN` oral reading — still without committing to a single speech vendor.
