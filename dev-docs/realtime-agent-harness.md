# Realtime agent harness for Aria — architecture brief

**Status:** research draft. Written 2026-08-22. Reviewed and extended 2026-08-23 — sections marked **[Claude Code addition]** were added after a research pass over current voice-agent practice (LiveKit Agents, Pipecat Smart Turn, OpenAI Realtime, Gemini Live, Cartesia / ElevenLabs / Inworld TTS, Deepgram / Scribe STT, ORF literature, amended COPPA rule). They fill gaps the draft left open: the end-to-end latency budget, the "instant" interaction design, false-interrupt recovery, reconnect and state ownership, child-audio privacy, the voice golden set, the worker topology, and the Phase 2 ticket delta. Revised again the same day after a strict design review (correctness, child safety, privacy, session integrity); those changes are marked **[Review fix 2026-08-23]** and, where they narrow an earlier addition, say so.  
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

### The latency budget — **[Claude Code addition]**

The draft quoted vendor ranges (S2S 150–300 ms, cascade 400–800 ms) but never set Aria's own numbers. The product bar is *"feels like a human tutor, instant"*. Human conversational gaps are ~200–500 ms; anything past ~800 ms voice-to-voice reads as a pause and past ~1.2 s reads as "the computer is thinking". These are the budgets the harness is built and tested against, measured at the child's speaker, p95, on a home-Wi-Fi network profile:

| Moment | Budget (p95) | How it is met |
|---|---|---|
| Child stops talking → Aria makes *some* sound | **≤ 300 ms** | Acknowledgement / back-channel from `speech_asset`, no model on the path (see "Instant by design") |
| Child stops talking → first *content* word (short answer, hint, praise) | **≤ 700 ms** | Endpoint 150–250 ms + FAST tier TTFT ≤ 250 ms (cached prompt, ≤ 60-token outputs) + first-segment gate ≤ 30 ms + TTS TTFA ≤ 120 ms + transport ≤ 80 ms |
| Child stops talking → first content word, arbitrary question needing TEACH | **≤ 1.5 s**, with acknowledgement at ≤ 300 ms | Speculative planning on partials; acknowledgement covers the gap; never a spinner |
| `INTERRUPT` → Aria's audio is silent at the speaker | **≤ 250 ms** (master-plan §11), target **≤ 150 ms** | Client ducks on local VAD; server confirms and cancels by `generationId` (see "Client-side first reactions") |
| Audio activated → audible `WELCOME` | **< 1 s** (master-plan §11), target **≤ 400 ms** | Welcome pre-synthesised during arrival, in the browser's audio buffer before activation |
| Visible personalised welcome after `ARRIVED` | < 500 ms (master-plan §11) | Unchanged |
| Aria-side end-of-turn decision after the child's last word | **≤ 250 ms** early band when semantically complete, up to 1.5 s when the turn detector says "still going" | Semantic turn detector + age-band endpointing, below |

Two rules that follow from the table:

1. **The LLM is never on the path to the first sound.** A model call decides *what* to say next; something the child hears must already exist, or be a verified asset, before that call returns.
2. **Every stage is measured per turn**, as spans, and written to the session's telemetry: `eou_ms`, `llm_ttft_ms`, `gate_ms`, `tts_ttfa_ms`, `transport_ms`, `e2e_ms`, `interrupt_stop_ms`. A turn that misses budget is a logged event, not a feeling. Regressions against these numbers block a release exactly as the golden sets do.
3. **[Review fix 2026-08-23]** **The numbers above are design targets, not acceptance requirements, until measured.** The 700 ms row already sums to ~630–730 ms of vendor figures before sentence *generation* (P0-19 gates a complete sentence, so TTFT is not the relevant measurement), event persistence, queueing and browser playout. The first Phase 2 week builds one thin end-to-end spike — one STT, one model, one TTS, LiveKit — and measures from the child's last audio sample to actual browser playout on one realistic network profile. The SLOs written into P1-14 / P2-12 are set from that measurement; until then the table is what we aim at, and a build that misses it is a finding, not a failure.

Reference points from the research (2026): Cartesia Sonic ≈ 40–90 ms TTFB, ElevenLabs Flash and Inworld ≈ 75–130 ms TTFA; Deepgram Nova-3 and ElevenLabs Scribe v2 Realtime ≈ 150–300 ms streaming; Pipecat Smart Turn v3.1 ≈ 10–60 ms on CPU; fast LLM tiers ≈ 200–400 ms TTFT with prompt caching. The 700 ms content budget is achievable with off-the-shelf parts and no heroics — but only if the stages overlap rather than run in series.

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

## Instant by design — **[Claude Code addition]**

The draft explains *how not to be slow*. This section is *how to feel instant*, which is a different job. A human tutor is instant not because she thinks fast but because she reacts before she has finished thinking. The harness copies that with five overlapping mechanisms. All of them live in the `TutorHarness` / voice worker, not in the UI, so the text path and the voice path share them.

### 1. Speculative planning on partials

Start the turn **before** end-of-turn is confirmed. Once the streaming transcript has been stable for ~200 ms (no revision of earlier words), run steps 1–3 of the turn (load context → policy → planner) on the partial. When `SPEECH_FINAL` arrives:

- if the final transcript is a prefix-compatible extension of the partial the plan was built on **and the planner's reading of it has not changed** (see below) → commit and keep the already-generated segments;
- otherwise → discard and rerun. Cost is a few wasted FAST calls per session; latency saved is the entire planner time.

**[Review fix 2026-08-23]** **Speculation has no side effects.** Prefix compatibility alone is too weak: "I don't know" and "I don't know if it is seven" are prefix-compatible and mean different things. So speculative work may *load context and draft a move* only. It may not write `session_event`, grade an answer, update learner or skill state, call a mutating tool, or start TTS for anything judgemental. The commit step re-runs the cheap deterministic checks (grading, `expects` match, intent) on the **final** transcript and commits only if they agree with what the draft assumed; a disagreement discards the draft. The harness test for this asserts that a discarded speculation left no row and no state change behind.

Do **not** speculate on TTS by default (LiveKit's own default is preemptive LLM on, preemptive TTS off; speculative audio that is discarded still costs money and can leak a half-syllable). Speculative TTS is a per-move opt-in for very short, low-risk moves (`PRAISE`, back-channels) only.

### 2. Acknowledge, then answer — the bridge system

*Revised 2026-08-23 after review: a fixed pool of hand-written openers felt static, and plain rules cannot classify what a child actually says ("tell me a joke", "my mom is calling me"). The bridge is now selected by a tiny classifier from a large pre-voiced library, and never composed live.*

A **bridge** is the small thing Aria says in the 0.3–1.5 s before the real, gated answer starts — what a human tutor does with "mm-hm" or "ooh, good question" while she thinks. Bridges are chosen at *t ≈ 0* of the turn and play from audio that already exists; the tutor model is never on the path to the first sound.

**Where bridges come from**

| Kind | Text | Audio | When |
|---|---|---|---|
| Library bridges | Generated **offline** by a model in bulk (thousands per band, per voice, per intent bucket), then gated once and reviewed by sampling | Synthesised offline, stored in `speech_asset` | Always available; the default |
| Personalised bridges | Generated **during the session**, in the background, while the child works on the current item — tied to this child and this item ("Hmm, the one with the twelve dogs…") | Synthesised immediately and pushed to the browser buffer as not-yet-playable | Used when ready; otherwise falls back to a library bridge |
| The answer's own opening | The tutor model is prompted so its first sentence is short and reactive ("Almost — look at the tens.") | Streamed through the segment gate | When the first gated segment is ready in time, **no bridge plays at all** |

Never: text chosen at the moment of the pause and voiced on demand. That is the 300–500 ms we are removing.

**How a bridge is chosen — rules → tiny classifier → bucket**

The selection runs on the *partial* transcript while the child is still speaking, so it finishes before end-of-turn and adds no latency.

1. **Rules first** (microseconds). What Aria just asked is the strongest signal: a move declares `expects`. A number when a number was expected is an *answer*; speech while Aria is mid-sentence is an *interrupt* (no bridge); a long silence before speaking biases toward *pause*. These catch the easy majority.
2. **Intent classifier second** (20–50 ms). A very small model — a fine-tuned few-million-parameter classifier or a FAST-tier call with a one-token output — takes `(expects, partial transcript, band)` and returns one label from a closed set:

   | Label | Example child speech | Bridge bucket | Side effect on the harness |
   |---|---|---|---|
   | `answer` | "seven", "the red one" | "Mm-hm…", "Let me check…" | none |
   | `question` | "why is the sky blue?" | "Ooh, good question." | planner told: child asked, not answered |
   | `stuck` | "I don't know", "I don't get it" | "That's okay. Let's look together." | `CONFUSED` evidence before the planner runs |
   | `request` / off-task | "tell me a joke" | "Ha — hold that thought." | planner told; policy decides whether to indulge |
   | `leaving` / life event | "my mom is calling me" | "Okay! Go ahead." | harness starts `PAUSE`; no tutoring reply |
   | `unclear` | mumbling, noise, low confidence | neutral "Mm-hm." | early band may get a `CHECK` move next |

   The classifier only ever picks a bucket. It composes nothing, so its worst error is a slightly less fitting bridge. Low confidence → `unclear` → neutral bucket.

   **[Review fix 2026-08-23]** The "side effect" column is a *hint to the planner*, not an action. The bridge path never writes evidence, never pauses a session and never changes state on its own; `stuck` and `leaving` are passed to the planner as `intentHint` and take effect only after the final transcript is in and the normal turn (policy → planner → gate) decides. This keeps a misclassified bridge harmless in fact, not just in wording.
3. **Bucket → clip** (sub-millisecond). Pick from the bucket for this band and voice, excluding the last N played, preferring a ready personalised bridge over a library one.

**What every bridge must obey**

- Non-committal: never "yes", "right", "no", "correct". Only the gated answer may judge. This is what makes a wrong bucket harmless and prevents the two-voices-contradict problem.
- Short: ≤ 1.2 s of audio, chosen so the content segment can follow without an audible seam.
- Skipped when the first gated content segment is already available, and skipped after a confirmed `INTERRUPT` — the child cut in to say something, not to hear "mm-hm".
- Gated once, like any other child-facing text, at library build time or at personalised-generation time — never at play time.
- Logged: `bridge_intent`, `bridge_asset_id`, `classifier_confidence` and whether it was skipped go on the turn's telemetry, so the voice golden set can grade bucket accuracy alongside end-of-turn accuracy.

Changing Aria's voice means regenerating the library — a batch job, not a live cost. The intent classifier is a port (`IntentClassifier`) like the turn detector, with a rules-only implementation for Phase 1 text sessions and the model-backed one arriving with Phase 2.

**First version, deliberately small — **[Review fix 2026-08-23]**** The table above is the target design. The review pointed out that thousands of generated clips per band, voice and intent create a review, storage and cache problem before a single child has used voice, and that the personalised path adds a second generation pipeline to a feature whose whole point is that nothing is generated at the pause. The first shipped version is therefore:

- a **hand-reviewed library of a few dozen clips per band and voice** (not thousands), grouped into the six buckets, every clip read and approved by a person — no sampling review;
- **rules + classifier choose the bucket; nothing else** — no state change, no evidence, no pause from the bridge path (above);
- **no personalised bridges and no browser preloading of bridges** in v1. The answer's own short opening sentence and the library cover the pause. Personalised bridges move to a follow-on ticket (P2-11b) that is scheduled only if the voice golden set shows the library repeating audibly within a session.

Growing the library by offline generation later is a batch job against the same `speech_asset` table and needs no protocol change.

This is the child-facing meaning of master-plan §4.1's "acknowledges it immediately and begins the first gated sentence as soon as it is safe".

### 3. Pre-synthesised next move

While the child works on item *n*, item *n + 1* is generated, gated **and synthesised**, and its audio is pushed to the client's buffer flagged `not-yet-playable`. The same applies to the most likely `HINT` for the current item and to the `WELCOME` during arrival. When the move is chosen, playback starts from local memory; the server merely sends "play asset X". Budget: at most 2 pre-synthesised moves in flight per session; unused ones are discarded at item change and their cost is logged as `speculative_waste_usd`.

### 4. Segment pipelining

**[Review fix 2026-08-23]** **Before any segment streams, the move is checked as a whole.** Individually acceptable sentences can add up to a wrong or unsafe explanation, and once sentence one has been spoken it cannot be withdrawn. So the planner's first output is a *small structured move plan* — the intended move type, whether the child's answer was judged correct, the teaching claim or explanation outline in one line, the verified content it references, and the permitted response type for this band — and the plan is validated (deterministic checks plus the existing correctness checker for arithmetic / MC) before generation of the spoken text begins. Sentence gating then remains the final safety check on each segment, not the main correctness mechanism.

Planner → segmenter → gate → TTS → transport run as a **pipeline per segment**, not per move. Segment 1 is being spoken while segment 2 is being gated and segment 3 is still being generated. The gate's per-segment latency must stay ≤ 30 ms for the streaming kinds (safety + level checks are deterministic or cached; a model-backed check applies only to whole-item kinds that were already buffered). If a later segment fails the gate, playback finishes the current sentence and the move ends on a verified fallback line — the child never hears a sentence retracted (P0-19 rule).

### 5. Client-side first reactions

Some reactions cannot wait for a round trip on home Wi-Fi:

- **Interrupt reflex — **[Review fix 2026-08-23]** duck, don't cut.** Raw client energy VAD fires on speaker echo, a TV, a cough, a sibling and "mm-hm", so it must not cancel Aria's speech on its own. The browser **ducks** playback (say −18 dB, ≤ 50 ms) the moment local VAD fires and reports `SPEECH_STARTED`. The server confirms the interrupt (≥ 300 ms of speech and a recognised word, below), then cancels every audio chunk carrying the current `generationId` — the client discards anything buffered with that id and un-ducks nothing. A false alarm un-ducks after the server says so; the child hears a dip, not a cut. Browser echo cancellation and noise suppression are on (`getUserMedia` constraints), and a visible **stop** button exists in every band as the explicit path. No custom client turn-detection model.
- **Listening state** ("I'm listening" visual, owl ear tilt in the early band) flips locally on VAD start.
- **Audio activation**: the buffered `WELCOME` plays on the class tap without a server hop.

The client never *decides* anything pedagogical; it only executes reflexes the harness has pre-authorised in the move (`move.reflexes: { duckOnSpeech: true, ... }`).

### What "instant" does not mean

- Not S2S at the browser edge. The gate stays on the critical path; the budget above shows the gate costs ~30 ms per segment, which is not what makes voice agents slow.
- Not shorter answers to hide latency. Aria's move length is a pedagogical choice per band, decided in policy, not a latency trick.
- Not a spinner, a "thinking" chime, or a typed ellipsis. Master-plan §4.1: the child never watches a model work.

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

### Worker topology and session ownership — **[Claude Code addition]**

The draft says "a long-lived Node voice worker". Production needs the shape spelled out:

- **One process per N sessions, one session per in-memory state machine.** The voice worker is a separate deployable (`apps/voice-worker`, sharing `packages/shared` and importing the tutor harness from a `packages/tutor` package rather than reaching into `apps/api`). It registers with the SFU as an agent dispatcher; the SFU assigns a room to a worker; the worker joins as a participant. Express never holds a media socket.
- **Session state lives in Postgres + a small hot cache, never only in the worker.** The worker keeps the live turn state (current move, pending speculation, TTS cursor) in memory but writes every committed `session_event` synchronously before the next move is emitted. A worker crash loses at most the move in flight.
- **Reconnect is a first-class event.** On media loss the client keeps the session UI, shows a calm "one moment" state (no error text in the early band), and the SFU reconnects with the same identity. The worker treats a re-joined participant as `RESUME`, replays the last emitted move's text (not its audio) and re-arms listening. Reconnect budget: < 3 s on a Wi-Fi blip, and a session survives a worker restart because a fresh worker can rebuild from `session_event` + `session` rows.
- **[Review fix 2026-08-23]** **Delivery is at-least-once with de-duplication, not "write then hope".** Writing an event before sending it does not tell us whether the child received the move; LiveKit's reliable data packets are not buffered for a participant that is disconnected. So: every committed move is persisted with a monotonically increasing `serverSeq` (a transactional outbox row next to its `session_event`), sent at least once, and the client acknowledges with `acknowledgedSeq`. On reconnect the client sends its `acknowledgedSeq` and `connectionEpoch`; the worker resends everything after it, and the client de-duplicates by move `id`. A worker crash therefore duplicates at most one move on the wire and loses none. This is an outbox and a cursor, not an event-streaming platform; nothing else in the system reads the outbox.
- **Region co-location.** Worker, STT, LLM and TTS endpoints in the same cloud region; the SFU edge close to the child. Cross-region hops are the single largest avoidable latency in cascades (LiveKit's latency guide ranks co-location as the highest-impact fix). Record the region per session in telemetry.
- **Cost meter on the worker.** Audio minutes for STT and TTS are metered per session, alongside tokens, into the same `ai_generation_log` / cost cap machinery (`cloud-model-layer.md` §9). A tripped cap degrades to cached moves; it never ends a session mid-sentence.
- **Text path and voice path are one harness.** `apps/api`'s `POST /session/turn` and the worker call the same `TutorHarness.handle()`. The worker adds only: audio ports, turn-taking, speculation, and the reflex flags on moves.

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

**Decision refinement — [Claude Code addition].** `@livekit/agents` for Node is now at 1.x (1.0 shipped August 2025; 1.5 added `Agent.create()`, tool sets and background tools; 1.6.x current) and carries the pieces Aria would otherwise rebuild: Silero VAD, the semantic turn detector, adaptive interruption with false-interrupt resume, preemptive generation, and `AgentSession` with pluggable STT / LLM / TTS. Feature parity between the Node and Python SDKs moves month to month (the 2026-08-22 pass listed dynamic endpointing as Python-only; the current turn-tuning docs no longer say so) — **[Review fix 2026-08-23]** **treat every capability claim in this document as unverified until the Phase 2 week-1 spike checks it against the installed version.** Pipecat is the strongest *design* reference but a Python runtime would split the stack; use its ideas, not its process. **[Review fix 2026-08-23]** For end-of-turn, **use LiveKit's own turn detector first** and measure it on the child test set; port or embed Pipecat Smart Turn only if that measurement shows it is needed. The recommendation is therefore concrete: **LiveKit SFU + `@livekit/agents` in `apps/voice-worker`, with Aria's `TutorHarness` supplied as the "LLM" stage** — the framework sees a function that takes transcript events and returns gated text segments; it never sees a vendor chat completion. If LiveKit's `AgentSession` fights the segment gate in practice, fall back to LiveKit for media only and run the VAD → STT → harness → TTS pipeline ourselves; the ports make that a worker-internal change.

**[Review fix 2026-08-23]** **The week-1 spike is a gate on locking interfaces**, not a warm-up. It must prove, with the real SDK version: (1) Aria supplies gated text segments as the "LLM" stage and nothing else reaches TTS; (2) an interrupt cancels audio all the way to the browser, measured; (3) preemptive generation cannot bypass the gate or write state; (4) reconnect preserves ordered, de-duplicated moves; (5) the chosen Node turn detector works on the initial child test set. Ports are locked only after the five pass.

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

Master-plan bar: ≥ 98% correct end-of-turn on a voice test set — budget a golden audio set in Phase 2, not anecdotes. **[Review fix 2026-08-23]** *The 98% figure is aspirational until the set is large enough to support it* (see "The voice golden set"); it is not a Phase 2 exit condition.

### Turn-taking for children, concretely — **[Claude Code addition]**

The draft is right that silence thresholds fail for kids. The rules to implement:

**End-of-turn = VAD stop × semantic turn model × band × move context.**

| Band | `minEndpointDelay` | `maxEndpointDelay` | Notes |
|---|---|---|---|
| early (TK–2) | 250 ms | 2.5 s | Long pauses mid-sentence are normal; the semantic model decides between 250 ms and 2.5 s |
| middle (3–5) | 300 ms | 2.0 s | |
| senior (6–8) | 400 ms | 1.5 s | Closer to adult defaults |
| any band during `LISTEN` (oral reading) | n/a | passage-driven | End-of-turn is "passage finished or 4 s of silence", never mid-passage |
| any band when `expects: 'choice'` | 200 ms | 1.0 s | One-word answers ("B", "seven") end fast |

The semantic turn model runs **on the worker CPU** (Pipecat Smart Turn v3.1 is open, BSD, ~8 MB, 10–60 ms CPU; LiveKit's turn detector is the same idea inside its framework). It is a port (`TurnDetector`) so it can be swapped, and its decisions are logged with the audio so the voice golden set can grade them.

**Interruption = adaptive, with false-interrupt recovery.**

- Confirmed interrupt requires ≥ 300 ms of child speech **and** at least one recognised word from the streaming STT (LiveKit exposes exactly these knobs: `minInterruptionDuration`, `minInterruptionWords`, `falseInterruptionTimeout`, `resumeFalseInterruption`). Energy-only VAD is used for the *client-side stop reflex*; the *server decision* to abandon the move waits for the word.
- Back-channels ("mm-hm", "yeah", "ok", a laugh) during Aria's speech are **not** interrupts. They are logged as `BACKCHANNEL` evidence (engagement signal, master-plan §4.3) and Aria continues.
- **False interrupt:** the client stopped audio on VAD but no word arrived within 1.5 s. Aria **resumes from the start of the interrupted sentence** (not mid-word) with a short bridge ("So —"). The resume is a new `SAY` move with `resumeOf: <moveId>`, so the transcript stays truthful.
- Noise floor is learned in the sound check and re-learned continuously; a TV in the room must not become a stream of false interrupts. If false interrupts exceed 3 per minute, the worker raises `minInterruptionDuration` for the session and emits a parent-visible note.
- Aria never interrupts the child. Silence handling (`SILENCE`) is the only way Aria takes the floor uninvited, and the window is band-specific (early: 6 s, middle: 8 s, senior: 10 s, doubled during `LISTEN`).

**Protocol additions (P0-02 amendment):** events `BACKCHANNEL`, `SPEECH_STARTED` (VAD start, for reflexes and telemetry), `MEDIA_LOST` / `MEDIA_RESTORED`; move field `resumeOf?: MoveId`; move field `reflexes?: { duckOnSpeech: boolean }` (was `stopOnSpeech`; the client ducks, the server cancels); `speech.assetId?` so a move can reference pre-synthesised audio. **[Review fix 2026-08-23]** **Ordering and replay fields on the envelope** (`common.schema.ts` today has only `id`, `at`, `sessionId`, `protocolVersion`): `serverSeq` (per-session monotonic, server-assigned, on moves), `turnId` (groups the events and moves of one child turn), `causationId` (the event a move answers), `connectionEpoch` (increments on every reconnect; stale-epoch messages are dropped), `acknowledgedSeq` (client → server cursor, on events), and `generationId` on speakable moves so audio cancellation is by id, not by timing. These are the minimum for a session to know what the child actually received; they are not a general event-streaming design. Together with the above they are the only changes the shared protocol needs for voice, and they bump `protocolVersion` with updated fixtures.

### Gating vs latency

S2S wants to speak immediately; Aria forbids raw tokens to the child. Compromise:

- **Cached / template moves** (`WELCOME`, common `HINT`s): speak from `speech_asset` with near-zero generation
- **Generated teaching:** stream **sentence segments** through the gate, then TTS chunk-by-chunk (first audible &lt; 1 s after activation for welcome)
- **Arithmetic / MC content:** buffer whole item until checker passes — never speak a wrong sum

This is why half-cascade fits better than pure S2S for a tutor that “must never be wrong about the subject.”

### What is spoken is checked, not only what is written — **[Review fix 2026-08-23]**

A correct sentence can be voiced wrongly: "3/4" read as "three slash four", "/k/" read as the letter name, "12" in a base-ten explanation read as "one two", an abbreviation spelled out. For a phonics or arithmetic lesson that teaches the wrong sound directly. Two rules:

- **Deterministic spoken forms.** Before TTS, a `spokenForm()` step rewrites fractions, operators, phoneme notation (`/k/` → the sound, never "slash k slash"), letter names vs letter sounds, digits in place-value contexts, abbreviations and punctuation into unambiguous text (or the provider's phonetic tags where supported). It is a pure function with table-driven cases and unit tests per curriculum scope; the gate runs on the written form, TTS receives the spoken form, captions show the written form.
- **A small reviewed audio set.** For the initial reading and arithmetic scope, a human listens to the synthesised output for every spoken-form case and every decodable word in the first units and approves it; the approved clips are cached in `speech_asset` and the check re-runs on any voice or vendor change. No generalised audio verification model — the review is the check.

### Children's speech is a different ASR problem — **[Claude Code addition]**

General-purpose STT is trained on adults. Published results and every child-speech vendor say the same thing: higher pitch, unstable pronunciation, and short disfluent utterances push word error rates well above adult numbers, and the youngest children are the worst case — exactly Aria's non-negotiable band. Design consequences:

- **Two STT ports, not one.** `ConversationalStt` (streaming partials + finals, low latency, good enough for answers and questions) and `ReadingStt` (word timestamps + confidence, tuned or biased for the passage). They may be the same vendor in Phase 2 but they are selected and measured separately.
- **Bias the recogniser with what we know — for conversation only.** For `ASK` with `expects: 'choice'`, the option texts; for arithmetic, number words. Deepgram's keyterm prompting (up to ~100 terms) and equivalents exist for this. The harness passes a `vocabularyHint[]` on conversational listening moves; the port ignores it if unsupported. **[Review fix 2026-08-23]** **Never feed the expected passage to `ReadingStt` as a prompt.** A recogniser primed with the passage tends to output what the child was *supposed* to say, hiding exactly the substitutions and omissions a reading assessment exists to find; the child-reading study cited below found expected-text prompting can make recognition worse and that miscue detection remains imperfect. Reading assessment uses an unprimed transcript (or forced alignment of the audio to the passage, which is a different tool with a different failure mode) and does its own alignment. Evaluate reading-specialist providers and forced-alignment approaches in Phase 2; do not train a custom ASR model initially.
- **Confidence drives the move, not the transcript alone.** A low-confidence final on a graded answer produces a `CHECK` ("Did you say seven?") in the early band rather than a wrong `PRAISE` or `RETEACH`. Never grade an early-band spoken answer from a transcript with confidence below the tuned floor.
- **Child-speech vendors are on the Phase 2 shortlist** (SoapBox Labs / the child-speech specialists, evaluated alongside Deepgram Nova-3 and ElevenLabs Scribe v2 Realtime). The voice golden set below is what decides; do not assume the vendor that wins on adult benchmarks wins on a six-year-old.

### Oral reading (`LISTEN`)

Do not use generic chat STT alone. Pipeline:

1. Known passage text (from verified content)
2. Streaming ASR with **word timestamps** (Deepgram, Whisper-timestamped-style, or child-speech-tuned vendors)
3. Align hypothesis → prompt (classic ORF literature: WCPM from correct words / on-task duration)
4. Map misses → phonics patterns → **unconfirmed observations** (not straight to `skill_state`; see below)

**Scoring detail — [Claude Code addition].** Alignment is dynamic-programming word alignment of hypothesis to reference (edit distance with substitution / omission / insertion), the same family as the ADAPT algorithm in the ORF literature. **[Review fix 2026-08-23]** *Accuracy claim corrected:* the earlier text said automated WCPM lands within 3–4 words of a human; the cited study's WCPM mean absolute error is 8.4 (the ~2.4 figure is for matched words, not WCPM). **Automated WCPM is an estimate with an uncertainty, and is stored as one** — each `LISTEN` result carries a confidence band derived from ASR confidence and alignment quality, and a low-confidence result is shown to the parent as approximate and never updates learner skill state. Rules: (a) WCPM = correct words ÷ on-task minutes, where on-task time excludes leading silence and Aria's prompts; (b) self-corrections within 3 s count as correct (standard ORF convention); (c) omissions and substitutions map to the *reference* word's phonics pattern, insertions map to nothing; (d) a `LISTEN` turn stores the aligned word list with timing as evidence on `session_event`, and the raw audio is retained only under the privacy rules below. Prosody scoring is out of scope until Phase 4.

**[Review fix 2026-08-23]** **A miscue is an observation, not a diagnosis.** A "missed word" may be an ASR error, noise, a dialect difference, a vocabulary gap, a skipped line, or a real decoding problem. The `miss → phonics pattern → skill_state` path in the draft would manufacture false learner profiles. Instead: a detected miscue is stored as an *unconfirmed observation* tagged with its phonics pattern and recognition confidence; a phonics weakness is written to `skill_state` only when the same pattern recurs across **several separate reading attempts on controlled words** with adequate confidence, and the threshold is a policy constant, not a model judgement. Automated diagnosis from a single reading is explicitly out of scope.

**[Review fix 2026-08-23]** **A room token authenticates the device, not the speaker.** A sibling or parent may answer while the child is logged in, and without voiceprints (which we will not build) Aria cannot know who spoke. So graded speech happens inside an explicit "your turn" interaction; when the speaker or the transcript is uncertain (confidence floor, mid-turn voice change flagged by the STT, two overlapping voices) Aria asks a `CHECK` rather than grading; and **durable evidence is never created from uncertain-speaker audio** — it is logged as unconfirmed like a miscue.

Capture timing events in Phase 2 even before full phonics curriculum (master plan already says this).

### Child audio and the amended COPPA rule — **[Claude Code addition]**

The FTC's amended COPPA rule (compliance deadline 22 April 2026, now in force) treats a child's voice recording as personal information, adds voiceprints as biometrics, requires **separate** verifiable parental consent before disclosing a child's personal information to third parties, requires a written data-retention policy with deletion, and requires disclosure of automated decision-making. Sending audio to an STT or S2S vendor is a third-party disclosure. Consequences for the harness, in code rather than policy prose:

1. **Consent gates the media plane.** `POST .../realtime` refuses to mint credentials unless the account carries *voice consent* (distinct from account consent) naming the vendor category. Text mode still works without it. This is a hard check in the controller, tested.
2. **Audio is transient by default.** Raw audio frames go to the STT port and are not written anywhere by Aria. What is retained is the transcript, the alignment, and the timing — the evidence Aria actually needs. **[Review fix 2026-08-23]** *Corrected:* the earlier text claimed this "fits the rule's audio exception". It does not, and the plan must not rely on it. The FTC's audio exception covers audio collected **solely** as a replacement for written words and deleted immediately; Aria also uses the child's voice to score reading and derive learner evidence, which is outside it. Therefore **verified parental voice consent is required before any audio is collected**, exception or not (item 1 is the mechanism), and child-privacy counsel reviews the exact STT, storage and assessment flow — vendor, purpose, retention and deletion behaviour recorded per endpoint — before voice launches.
3. **Retained audio is opt-in and purpose-bound.** Oral-reading clips may be retained *only* when the parent opts in for that purpose (hear your child read, human re-grading), with a stated retention period (default 90 days) enforced by a scheduled job, and never used to train or tune any model — ours or a vendor's. Choose STT/TTS vendors with zero-retention terms for child audio; record the term per endpoint in `ai.yaml` comments as `cloud-model-layer.md` §11 already requires for text.
4. **No voiceprints.** Speaker identification, voice cloning of the child, and any biometric derivation are never built. The transport authenticates the session token, not the voice.
5. **The parent can see it.** The transcript view shows which turns were voice, which vendor category received them, and the retention state of any clip.
6. **Aria's own voice is not a real person's clone** unless licensed for exactly this use; and the child is never told Aria is human (already implied by master-plan §12, stated here because voice makes the illusion strong).
7. **[Review fix 2026-08-23]** **Consent and deletion cover the processors, not only our database.** "We do not write audio" proves nothing about LiveKit, the STT vendor, request logs, support tooling or their subprocessors. Vendors are chosen for contractually enforceable no-training and zero- or bounded-retention terms for child audio; a short **processor list and deletion map** (which system holds what derived artefact, and how it is deleted) lives in `dev-docs` and is kept current by the P2-03 ticket. On consent withdrawal the media session ends immediately, the outbox stops, and retained clips plus derived voice artefacts are deleted at every processor on the map, with the deletion recorded.

### Voice safety: transcripts are not enough — **[Review fix 2026-08-23]**

P1-13's safety layer operates on the child's *text*. In voice, the exact phrase that should trigger the crisis path may be the one young-child ASR gets wrong. Two changes, both amendments to P1-13:

- **High-risk detection reads more than the final transcript.** For the deterministic crisis patterns, the input classifier is given the streaming alternatives (n-best where the provider offers it) and a low-confidence phonetic match, not only the top hypothesis. A near-miss on a high-risk pattern with low confidence does **not** continue normal tutoring: Aria gives a reviewed, neutral safety response ("I want to make sure I heard you. Can you say that again?" in the early band) and the turn is flagged for human review. Uncertain is treated as "possibly serious", never as "nothing".
- **"Notify the parent immediately" is replaced by an escalation matrix.** The parent — or another household member — may be the person the child is describing; automatic notification can raise the child's risk. A child-safeguarding professional defines a small matrix for *self-harm*, *immediate physical danger*, *abuse by a household member* and *general distress*: for each, the reviewed wording Aria uses and the approved human contact route (which may be the parent, a designated emergency contact, or a hotline handoff, never invented by a model). P1-13's `notify.ts` becomes `escalate.ts` and routes by that matrix. Aria does not attempt counselling; the matrix is four rows, not a system.

### Browser autoplay / permissions

Harness must emit moves that the UI can play **when** audio is unlocked; never block the session on `say` failing. Mic sound-check, device recovery, captions, mute, text/tap fallback are part of the live session state machine.

---

## The voice golden set and harness tests — **[Claude Code addition]**

`master-plan.md` §11 sets numbers (≥ 98% end-of-turn, < 250 ms interrupt, < 1 s audible welcome) and the draft says "budget a golden audio set". This is what it contains and how it runs, so Phase 2 does not ship on anecdotes.

**The set (`dev-docs/golden/voice/`)** — recorded with parental consent under the rules above, or synthesised where noted:

| Slice | Content | Grades |
|---|---|---|
| End-of-turn | ~300 child utterances per band with human-marked turn ends: complete answers, mid-sentence pauses, trailing "um", counting aloud, reading with pauses | turn detector precision / recall, decision latency |
| Interrupt vs back-channel | ~200 clips of Aria speaking with overlaid child audio: real cut-ins, "mm-hm", laughs, background TV, sibling voice | interrupt precision / recall, stop latency |
| Answer recognition | Spoken answers to `ASK` items per band, including number words, letters, single options | STT word accuracy on the answer, confidence calibration |
| Bridge intent | ~300 child utterances per band labelled answer / question / stuck / request / leaving / unclear, including off-script speech ("tell me a joke", "my mom is calling") | classifier bucket accuracy, and that no bridge commits to a judgement |
| Oral reading | Decodable passages read by children at several levels, with human WCPM and miss lists | WCPM error vs human, miss detection F1 |
| Noise / device | The above re-recorded through laptop mics, tablets, a cheap headset, 20 dB SNR kitchen noise | degradation curves |
| Latency scenarios (synthetic) | Scripted sessions replayed bot-to-bot through the real worker with a simulated network profile (home Wi-Fi, 50 ms RTT, 1% loss) | every per-turn span against the budget table |

**[Review fix 2026-08-23]** **What the set can and cannot prove.** ~300 utterances per band cannot establish a universal 98% end-of-turn rate once results are split by age, device, noise and utterance type — the per-cell counts are too small. So the first release makes the smaller claim it can support: per-band end-of-turn and interrupt precision/recall with confidence intervals on *the supported age range, a few representative devices, quiet and noisy rooms, interruptions, short answers and oral reading*. The 98% bar becomes a stated target with the sample size needed to assert it (on the order of thousands of human-labelled turns per cell of interest) recorded next to it, and is claimed only when that data exists. Headless replay also misses speaker echo and browser behaviour; a small **real-browser** suite (Playwright driving the session UI with a loopback audio device) covers the duck / cancel path and echo cancellation on the representative devices.

**How it runs.** A `voice:golden` task feeds audio files into the worker through the same media path a browser uses (a headless SFU participant), records the harness's events and per-turn spans, and reports against the budget table and §11 bars. It runs on every change to the worker, the turn detector, the STT/TTS provider config or the segment gate; a regression blocks the change, exactly like the content and tutoring sets. Model-graded scoring is allowed for *transcript quality* only; turn and interrupt correctness are graded against human marks.

**Harness unit tests that must exist (Phase 0/1 where possible):**

- No raw token or raw audio frame reaches a child-facing emitter (extends P0-19's named test to the audio emitter).
- `INTERRUPT` aborts the in-flight LLM request, the TTS stream and the speculation, and no segment from the aborted move is emitted after the abort.
- A speculative plan is committed only when the final transcript is prefix-compatible and the deterministic checks agree; otherwise it is discarded and the rerun result is what is emitted — and a discarded speculation has written no `session_event`, no evidence and no state.
- **[Review fix 2026-08-23]** A low-confidence `LISTEN` result never updates `skill_state`; a single miscue never creates a phonics weakness.
- **[Review fix 2026-08-23]** An `INTERRUPT` that is not confirmed server-side leaves the move playing (ducked, then restored); a confirmed one cancels every chunk with the move's `generationId` and nothing with that id plays afterwards.
- **[Review fix 2026-08-23]** After a simulated disconnect and reconnect with a stale `acknowledgedSeq`, the client receives every missed move exactly once in `serverSeq` order.
- A false interrupt resumes at a sentence boundary with `resumeOf` set.
- The realtime controller refuses credentials without voice consent.
- A worker restart mid-session resumes from `session_event` with the same session id and no duplicate move.

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
| Feel — *[Claude Code addition]* | Targets (SLOs set by the Phase 2 spike): ≤ 300 ms to first sound, ≤ 700 ms to first content word, ≤ 150 ms interrupt stop; side-effect-free speculative planning, small reviewed bridge library (rules → intent classifier → pre-voiced bucket), pre-synthesised next move, move-plan check then segment pipelining, client duck reflex |
| Turn-taking — *[Claude Code addition]* | Semantic turn detector (Smart Turn v3.1 default) × band endpointing table; adaptive interrupt with false-interrupt resume; back-channels are evidence, not interrupts |
| Children's speech — *[Claude Code addition]* | Separate `ConversationalStt` / `ReadingStt` ports, vocabulary biasing, confidence-driven `CHECK`; child-speech vendors on the shortlist |
| Privacy — *[Claude Code addition]* | Voice consent gates the media plane; audio transient by default; opt-in purpose-bound retention; no voiceprints |
| Proof — *[Claude Code addition]* | Voice golden set + per-turn latency spans; regressions block release |
| Integrity — ***[Review fix 2026-08-23]*** | Move outbox with `serverSeq` / ack cursor / `connectionEpoch`; cancel by `generationId`; whole-move plan check before streaming; deterministic spoken forms |
| Assessment — ***[Review fix 2026-08-23]*** | WCPM is an estimate with a confidence band; miscues are unconfirmed until they recur; no passage prompting of reading STT; uncertain-speaker audio never becomes evidence |
| Safety — ***[Review fix 2026-08-23]*** | Crisis detection reads n-best / phonetic near-misses; uncertain → neutral reviewed response + human review; escalation matrix replaces automatic parent notification |

**Why this wins against the plan:** preserves “product owns the protocol,” satisfies interruption and oral-reading needs, keeps the quality gate on the critical path, and lets Phase 1 ship text while Phase 2 plugs in live audio without rewriting the UI contract.

---

## What Phase 0 should lock now (before picking vendors)

1. Shared **event/move** types including `SPEECH_*`, `INTERRUPT`, `SILENCE`, `LISTEN`
2. Ports above (even with stub / scripted implementations)
3. Rule: child-facing release = gated sentence or verified asset only
4. Latency SLOs from master-plan §11 as harness acceptance tests — **[Review fix 2026-08-23]** as *tracked targets* in Phase 0/1; they become blocking acceptance numbers only after the Phase 2 week-1 spike sets them from measurement
5. Decision record: SFU-backed WebRTC vs raw WS — default **SFU** unless you explicitly accept rebuilding media
6. *[Claude Code addition]* The protocol amendments in "Turn-taking for children" (`BACKCHANNEL`, `SPEECH_STARTED`, `MEDIA_*`, `resumeOf`, `reflexes`, `speech.assetId`, `vocabularyHint`) and **[Review fix 2026-08-23]** the envelope ordering fields (`serverSeq`, `turnId`, `causationId`, `connectionEpoch`, `acknowledgedSeq`, `generationId`) — into P0-02 now with a `protocolVersion` bump and fixtures, before P0-08/09 render every move
7. *[Claude Code addition]* The latency budget table as named acceptance numbers, and per-turn span names (`eou_ms`, `llm_ttft_ms`, `gate_ms`, `tts_ttfa_ms`, `transport_ms`, `e2e_ms`, `interrupt_stop_ms`) in the observability ticket (P1-14) so the text path is measured the same way the voice path will be
8. *[Claude Code addition]* `TutorHarness` lives in a package (`packages/tutor`) importable by both `apps/api` and the future `apps/voice-worker`, not inside `apps/api/src/services` — this changes P1-06's file layout and is cheaper to decide now

Provider choice (OpenAI Realtime vs Gemini Live vs Deepgram + Cartesia/ElevenLabs) stays a **measured Phase 2** decision, as `cloud-model-layer.md` already says.

---

## Phase 2 ticket delta — **[Claude Code addition]**

`tickets/BACKLOG.md` reserves P2-01 … P2-10. The sections above imply these changes when Phase 2 is written out in full; recording them here so the reservation stays stable:

| Ticket | Change |
|---|---|
| P0-02 → **P0-27 (new ticket)** | Add `BACKCHANNEL`, `SPEECH_STARTED`, `MEDIA_LOST`, `MEDIA_RESTORED` events; `resumeOf`, `reflexes.duckOnSpeech`, `speech.assetId`, `generationId` on moves; `vocabularyHint[]` on conversational listening moves; **[Review fix 2026-08-23]** envelope fields `serverSeq`, `turnId`, `causationId`, `connectionEpoch`, `acknowledgedSeq`. P0-02 is already merged, so this is a real amendment: bump `protocolVersion`, update fixtures and the P0-08/09 renderers that consume them. Small, vendor-neutral, cheaper now than later. |
| P0-19 (amend now) | Per-segment gate latency budget ≤ 30 ms for streaming kinds; a gate-latency metric on the gated stream; **[Review fix 2026-08-23]** the whole-move plan check before streaming starts, and the `spokenForm()` step between gate and TTS. |
| P1-06 (amend now) — **[Review fix 2026-08-23]** | The harness moves from `apps/api/src/services/tutor/` to `packages/tutor`; speculation is side-effect-free by construction (draft-only step; commit re-checks on the final transcript). |
| P1-13 (amend now) — **[Review fix 2026-08-23]** | Voice safety: n-best / phonetic matching for high-risk patterns, reviewed neutral response on uncertainty with human review; `notify.ts` → `escalate.ts` driven by the safeguarding escalation matrix (self-harm, immediate danger, household abuse, general distress). |
| P1-14 (amend now) — **[Review fix 2026-08-23]** | Per-turn span names as tracked targets; the blocking SLO values are filled in from the Phase 2 spike. |
| P2-01 | Provider decision is made **by the voice golden set**, with the child-speech vendors on the shortlist for `ReadingStt`. |
| P2-02 | Becomes "SFU + `apps/voice-worker` + `packages/tutor` extraction"; week 1 is the five-point spike (gated segments as the LLM stage, browser-verified cancel, no gate bypass by preemptive generation, ordered de-duplicated reconnect, Node turn detector on the child set) and the end-to-end latency measurement that sets the SLOs. Interfaces lock after it passes. |
| P2-03 | Adds the voice-consent gate, region selection, **[Review fix 2026-08-23]** the processor list / deletion map, and vendor retention terms recorded per endpoint. |
| P2-04 | Adds pre-synthesis of next move / hint / welcome and the speculative-waste cost meter. |
| P2-05 | Adds the `TurnDetector` port (LiveKit's detector first; Smart Turn only if measured necessary), the per-band endpointing table, and the false-interrupt resume. |
| P2-06 | Barge-in is split: client **duck** reflex + stop button + echo cancellation (this ticket) and server-confirmed cancel by `generationId` (P2-05). |
| P2-09 | **[Review fix 2026-08-23]** Reading results carry a confidence band; miscues are unconfirmed observations; no passage prompting of `ReadingStt`; speaker-uncertain audio never becomes durable evidence. |
| P2-10 | **[Review fix 2026-08-23]** Phase 2 exit gains three blocking conditions beyond "a five-year-old completes a session alone": no false praise or false reteach on the human-labelled core set; no low-confidence reading result updates durable skill state; human review finds no materially incorrect spoken teaching in the initial curriculum scope. |
| **P2-11 (new)** | The bridge system, v1 scope: a hand-reviewed library of a few dozen clips per band and voice in `speech_asset`, `IntentClassifier` port (rules-only in Phase 1, model-backed in Phase 2) that picks a bucket and nothing else, skip rules, seam quality, bucket-accuracy slice in the voice golden set. **[Review fix 2026-08-23]** Personalised bridges, browser preloading of bridges and bulk offline generation are **P2-11b**, scheduled only on evidence of audible repetition. |
| **P2-12 (new)** | Voice golden set + `voice:golden` runner + per-turn latency spans. Blocks P2-10. |
| **P2-13 (new)** | Reconnect and worker-restart resume via the move outbox (`serverSeq` / `acknowledgedSeq` / `connectionEpoch`, at-least-once + de-dup); session survives a `MEDIA_LOST` and a worker crash with no lost or duplicated move. |
| **P2-14 (new)** | Child-audio privacy: transient audio, opt-in retention job, no-voiceprint assertion, parent transcript view flags, **[Review fix 2026-08-23]** consent-withdrawal deletion across the processor map, counsel sign-off on the flow before launch. |

**Explicitly deferred — **[Review fix 2026-08-23]**** so nobody builds them by accident: thousands of bridge recordings; personalised speculative bridges; speculative TTS; custom child-ASR training; a custom turn-detection model; speaker recognition or voiceprints; prosody scoring; multi-region worker deployment; a general event-streaming platform or full event sourcing; custom WebRTC infrastructure; large-scale personalised speech caching; automated diagnosis from reading miscues; voice beyond the initial language and curriculum scope; long-term learning experiments before the core voice loop is trustworthy.

## Research references (2025–2026)

- [OpenAI Voice agents](https://developers.openai.com/api/docs/guides/voice-agents) — S2S vs chained pipeline
- [OpenAI Realtime WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc) — Express ephemeral session pattern
- [LiveKit turn detection & interruptions](https://livekit.com/blog/turn-detection-and-interruption-handling) — VAD, semantic EOU, adaptive barge-in (Node SDK)
- [Pipecat speech input & turn events](https://docs.pipecat.ai/pipecat/learn/speech-input) — Silero VAD + Smart Turn
- WebRTC vs WebSocket for voice agents — hybrid SFU + server-mediated model leg is the common production pattern
- Oral reading / WCPM automation — ASR + prompt alignment; word timestamps required for fluency metrics

**Added 2026-08-23 [Claude Code addition]:**

- [LiveKit — Understand and improve agent latency](https://livekit.com/blog/understand-and-improve-agent-latency) — co-location first; per-turn spans (`e2e_latency`, LLM TTFT, TTS TTFB)
- [LiveKit — Turn-taking tuning](https://docs.livekit.io/agents/logic/turns/tuning/) — endpointing min/max, `minInterruptionDuration/Words`, `falseInterruptionTimeout`, `resumeFalseInterruption`, preemptive generation defaults; Node-only gaps
- [LiveKit Agents for Node.js](https://github.com/livekit/agents-js) — 1.x `AgentSession`; 1.5 `Agent.create()`, tool sets
- [Pipecat Smart Turn v3](https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/) and [v3.1](https://www.daily.co/blog/improved-accuracy-in-smart-turn-v3-1/) — open semantic end-of-turn model, ~95% English, 10–60 ms CPU
- [Pipecat speech input](https://docs.pipecat.ai/pipecat/learn/speech-input) — VAD + turn analyser composition
- [ElevenLabs — voice agent latency optimization](https://elevenlabs.io/blog/voice-agent-latency-optimization); [Scribe v2 Realtime](https://elevenlabs.io/blog/introducing-scribe-v2-realtime) — ~150 ms streaming STT
- [Gradium TTS latency benchmark 2026](https://gradium.ai/content/tts-latency-benchmark-2026); [Inworld TTS benchmarks](https://inworld.ai/resources/best-voice-ai-tts-apis-for-real-time-voice-agents-2026-benchmarks) — TTFA vs TTFB, Cartesia / ElevenLabs Flash / Inworld numbers
- [Deepgram Nova-3 keyterm prompting](https://developers.deepgram.com/docs/keyterm) — vocabulary biasing, word timestamps
- [SoapBox Labs — kids' speech recognition](https://www.soapboxlabs.com/technology/); [Age-aware adapter tuning for children's ASR](https://arxiv.org/html/2606.05440); [Improving child speech recognition and reading-mistake detection by using prompts](https://arxiv.org/pdf/2506.11079)
- [Human and automated assessment of oral reading fluency](https://eric.ed.gov/?id=EJ1054417); [NAEP ORF scoring](https://nces.ed.gov/nationsreportcard/studies/orf/scoring.aspx); [Sub-sequence alignment for ORF](https://s2.smu.edu/~eclarson/pubs/2024_icassp_orf.pdf)
- [OpenAI Realtime pricing, measured](https://hackernoon.com/openai-realtime-api-pricing-in-2026-real-world-data-from-4000-measured-sessions) — ~$0.05–0.15/min S2S; [Gemini Live API](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/live-api) — GA on Vertex, proactive audio, affective dialog
- [EVA-Bench](https://arxiv.org/abs/2605.13841) and [Microsoft Voice Live Evaluation Harness](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/evaluate-before-you-ship-introducing-the-voice-live-evaluation-harness/4523064) — bot-to-bot audio replay for regression testing
- [FTC COPPA FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions); [Amended COPPA rule 2026 checklist](https://privacylawmap.com/blog/coppa-rule-amendments-april-2026-compliance-checklist) — audio as PI, voiceprints, separate third-party consent, retention policy
- [Claude — reducing latency](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-latency); [Claude + ElevenLabs low-latency voice cookbook](https://platform.claude.com/cookbook/third-party-elevenlabs-low-latency-stt-claude-tts) — streaming, prompt caching for TTFT

---

## Suggested next doc

A short **Phase 2 live session design**: interfaces + sequence diagrams for `ARRIVED` → spoken welcome → barge-in → `LISTEN` oral reading — still without committing to a single speech vendor.
