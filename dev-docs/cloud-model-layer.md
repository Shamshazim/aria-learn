# The Model Layer — Cloud Only

**Status:** design agreed, not yet implemented. Revised 2026-08-22 for the rewrite.
**Phase:** 0 (Foundation) of [`master-plan.md`](master-plan.md). Phase 1 does not start until
this and the rest of the Phase 0 exit test pass.
**Owner decision, 2026-08-21:** *"We only support cloud models for now. No local models."*

**Read first:** [`rewrite.md`](rewrite.md). This model layer is built fresh for the tutor
behaviour in [`master-plan.md`](master-plan.md). Legacy provider code is not carried forward.
The requirements below — configurable routing, quality, streaming capability, cost,
privacy and failure handling — are authoritative; historical class shapes are not.

---

## 1. The decision, in one paragraph

Aria calls a **hosted model over the network**. There is no bundled Ollama, no local
weights, no offline mode. The reason is simple: `qwen2.5:7b` cannot teach. It writes
arithmetic that is wrong, it writes HTML into question text, and it takes 6 to 38 seconds
to do it. A tutor that is sometimes wrong about 7 + 8 is not a tutor. We would rather ship
a product that needs internet and is genuinely good than one that works on a plane and
teaches a child the wrong thing.

We build a **provider port** so cloud-only does not mean vendor lock-in. Any hosted model
that uses a supported wire format must plug in through configuration alone.

---

## 2. What this changes

| Area | Before | After |
|---|---|---|
| Engine | Bundled Ollama, private dynamic port | HTTPS call to a hosted API |
| Offline | Full offline promise | **Gone.** Aria needs internet |
| Packaging | Electron bundling JRE + PostgreSQL + Ollama (~5 GB) | A web app calling a hosted API. See [`rewrite.md`](rewrite.md) §6. |
| Data location | Nothing left the machine | Account data lives in Aria's service; scrubbed prompt context crosses the model-vendor boundary |
| Cost | Zero marginal | Per token, per child, per session |
| Latency | 6–38 s | 0.5–4 s typical, plus network |
| Failure mode | Engine crash, app respawns it | Network down, rate limit, vendor outage |

Four of these are new problems we did not have. Sections 7, 8, 9 and 10 exist because of
them. Do not skip them: **cost control, key handling, failure handling and privacy are part
of Phase 0**, not follow-up work.

### What we simply never build

The first version bundled Ollama and supervised it as a child process. In the rewrite there
is nothing to delete — these things are on the list of code we never write:

- No local provider, no `OLLAMA_URL`, no bundled model weights.
- No engine supervisor: no respawn loop, no widening retry delay, no same-port rule, no
  `pkill -f "ollama serve"` hazard.
- No download-and-bundle step in any build.
- No "hide the word Ollama from the child" special case. Section 8 is the replacement, and
  it is a real design rather than a workaround.

Everything under `legacy/` that implements the above stays frozen. It is not a module map or
implementation checklist for the new model layer.

---

## 3. The design

Build the following design in TypeScript in `apps/api`. `AiClient` is the only module
outside the provider folder that touches `LlmProvider`; everything else talks to `AiClient`.
That single seam makes the vendor a configuration detail.

```
AiClient
   │  provider.complete(LlmRequest)
   ▼
RoutingLlmProvider          ← the single routed provider used by AiClient
   │  picks an endpoint by ModelTier, with fallback
   ▼
LlmProviderFactory          ← builds one adapter per configured endpoint at startup
   │
   ├── OpenAiCompatibleProvider   (api: openai)
   ├── AnthropicProvider          (api: anthropic)
   └── GeminiProvider             (api: gemini — only if we need native features)
```

**Two adapters cover nearly every vendor.** Most hosted models speak the OpenAI
chat-completions wire format. One adapter plus a different `base-url` covers OpenAI, Groq,
Together, Fireworks, Mistral, DeepSeek, xAI, OpenRouter, Azure OpenAI, and Gemini's
compatibility endpoint. Anthropic's Messages API differs enough to need its own adapter.

### The modules to write

```
apps/api/src/ai/provider/
  types.ts            LlmProvider (the port), LlmRequest, LlmResponse (+ cost, see 9),
                      ModelTier
  config.ts           Parses and validates the config in section 4. Fails at startup.
  factory.ts          Endpoint -> adapter, one per configured endpoint, at boot
  routing.ts          Tier -> endpoint, retry, fallback, circuit breaker.
                      The only LlmProvider the rest of the app ever sees.
  health.ts           Startup check per routed endpoint, and a status route
  adapters/
    openaiCompatible.ts
    anthropic.ts
```

The diagram names describe responsibilities. They do not require class-for-class translation
from any previous implementation.

---

## 4. Configuration

One block. Adding a vendor is a config change and an API key. It is never a code change,
unless the vendor speaks a wire format we do not have an adapter for.

The YAML below defines the required shape for the new Node service. It becomes a checked-in
`apps/api/config/ai.yaml` (or an equivalent TypeScript module), parsed and validated at boot
by `config.ts`, with `${VAR}` resolved from the environment.

```yaml
app:
  ai:
    # Which endpoint serves each logical tier.
    routing:
      TEACH:    { endpoint: anthropic-sonnet, fallback: openai-gpt }
      FAST:     { endpoint: groq-llama,       fallback: anthropic-haiku }

    endpoints:
      anthropic-sonnet:
        api: anthropic
        base-url: https://api.anthropic.com
        api-key: ${ANTHROPIC_API_KEY}
        model: claude-sonnet-5
        max-tokens: 2048
        timeout-seconds: 60
        cost-per-mtok-in: 3.00
        cost-per-mtok-out: 15.00

      anthropic-haiku:
        api: anthropic
        base-url: https://api.anthropic.com
        api-key: ${ANTHROPIC_API_KEY}
        model: claude-haiku-4-5-20251001
        max-tokens: 1024
        timeout-seconds: 30
        cost-per-mtok-in: 1.00
        cost-per-mtok-out: 5.00

      openai-gpt:
        api: openai
        base-url: https://api.openai.com/v1
        api-key: ${OPENAI_API_KEY}
        model: gpt-5
        timeout-seconds: 60

      groq-llama:
        api: openai                                   # same wire format
        base-url: https://api.groq.com/openai/v1
        api-key: ${GROQ_API_KEY}
        model: llama-3.3-70b-versatile
        timeout-seconds: 20
```

### Rules

1. **Only endpoints named in `routing` are constructed.** An endpoint block with no key set
   and no reference from `routing` is inert. This lets us keep vendor blocks in the file
   without demanding every key.
2. **A missing key for a routed endpoint fails at startup**, with the name of the endpoint
   and the name of the environment variable. It does not fail later, in front of a child.
3. **Keys come from the environment only.** Never a literal in the config file. `.env`
   stays gitignored. A key is never written to a log, an error message, or the database.
4. **Both tiers may point at the same endpoint.** That is the simplest working setup.

---

## 5. The two adapters

### 5.1 `OpenAiCompatibleProvider`

- `POST {base-url}/chat/completions`
- Header `Authorization: Bearer {key}`
- Body: `model`, `messages` (system then user), `temperature`, `max_tokens`, and
  `response_format: {"type":"json_object"}` when `LlmRequest.jsonMode()` is true.
- Read `choices[0].message.content`, `usage.prompt_tokens`, `usage.completion_tokens`.

**Two traps.** Reasoning models (the o-series, `gpt-5`) reject any `temperature` other than
1 and want `max_completion_tokens` instead of `max_tokens`. Put a boolean
`reasoning: true` on the endpoint config and branch on it. Second: some compatible vendors
do not support `response_format`. When a vendor rejects it, fall back to prompt-only JSON
and use a new defensive JSON extractor that strips fences and rejects ambiguous output.

### 5.2 `AnthropicProvider`

- `POST {base-url}/v1/messages`
- Headers `x-api-key: {key}` and `anthropic-version: 2023-06-01`
- The system prompt is a **top-level `system` field**, not a message.
- `max_tokens` is **required**.
- Read `content[0].text`, `usage.input_tokens`, `usage.output_tokens`.

**There is no JSON mode.** *Amended by P0-12:* assistant prefill was the original plan, but
Claude 4.6+ rejects prefill, so the adapter instructs the model to return exactly one JSON
object and extracts it from the reply (`json-extract.ts`), the same prompt-only path the
OpenAI-compatible adapter falls back to.

### 5.3 What both must guarantee

- Never throw a raw HTTP exception upward. Wrap in `AiException`.
- Never put the API key, the child's name, or the prompt body into a log line.
- Always return a populated `LlmResponse`, including `latencyMs` measured around the call.

---

## 6. Tier routing

Start `ModelTier` as a two-value enum. It is the main model cost-and-quality routing lever.

| Tier | Used for | Wants |
|---|---|---|
| `TEACH` | explanation, lesson generation, evaluation, the quality gate, memory consolidation and learner briefs | Accuracy. This is where a wrong answer harms a child. |
| `FAST` | hints, grading a short answer, chat turns, classification | Latency. A child is waiting. |

A single `TEACH` call that is right beats three `FAST` calls that are wrong. Do not move a
prompt to `FAST` to save money without running the golden set (section 12) and reading the
result.

---

## 7. Keys and secrets

1. Keys live in the environment. `backend/.env` for development, gitignored.
2. **The desktop app is the hard problem.** A key shipped inside an Electron bundle is a
   public key. Anyone can extract it. Two acceptable answers:
   - **(A) Our proxy.** The desktop app calls an Aria-operated endpoint with the parent's
     account token. We hold the vendor key. This also gives us rate limiting, cost caps and
     abuse control, and it is the only option compatible with a subscription.
   - **(B) Bring your own key.** The parent pastes their own vendor key into settings. It
     is stored in the OS keychain, never in our database. This is a developer-grade answer
     and not a consumer product.
   **Take (A).** Note that this makes an Aria account mandatory, which the offline build
   did not need. Say so in the product copy.
3. Rotate on a schedule. Nothing in the code should make rotation hard: a key is read at
   startup only, so a restart is a rotation.

---

## 8. When the network fails

This is now a normal condition, not an exception. Four layers, in order.

1. **Retry.** On `429` and `5xx`, retry with exponential backoff and jitter — 3 attempts
   maximum, and honour a `Retry-After` header when the vendor sends one. Never retry `4xx`
   other than `429`; a bad request will stay bad.
2. **Fallback endpoint.** If the primary endpoint for a tier fails after retries, use the
   `fallback` named in `routing`. Log the switch. Do not fall back on a content error —
   only on a transport or availability error.
3. **Cache.** The initial content cache from `master-plan.md` Phase 0 holds verified,
   non-personalised items. A child can keep working through a short outage on cached
   content. Pre-generation makes this real rather than theoretical.
4. **Say it plainly.** If all of the above fail, the child sees:
   *"Aria can't reach her brain right now. Check the internet and try again in a minute."*
   No vendor name, no model name, no status code. The parent view may show the detail; the
   child never does.

Add a **circuit breaker** per endpoint: after N consecutive failures, stop calling it for
a cooling period and go straight to the fallback. Without it, a vendor outage means every
child waits the full timeout on every turn.

---

## 9. Cost

Every token is now money. Instrument this from day one, not after the first surprising
invoice.

**The `ai_generation_logs` table**, created with the cost columns present rather than added
to it later — this is a new database, so there is no `ALTER` to write:

```sql
CREATE TABLE ai_generation_log (
  id            UUID PRIMARY KEY,
  student_id    UUID REFERENCES student(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  endpoint_name VARCHAR(64) NOT NULL,
  model         VARCHAR(128) NOT NULL,
  tier          VARCHAR(16)  NOT NULL,
  tokens_in     INTEGER NOT NULL,
  tokens_out    INTEGER NOT NULL,
  latency_ms    INTEGER NOT NULL,
  cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
  cached        BOOLEAN NOT NULL DEFAULT FALSE,
  ok            BOOLEAN NOT NULL
);
CREATE INDEX idx_ai_log_student_day ON ai_generation_log (student_id, created_at);
```

`LlmResponse` carries `endpointName` and `costUsd`, computed by the adapter from the
`cost-per-mtok-*` values on the endpoint config.

**The number that matters is cost per child per month.** Track it from the first day. If a
30-minute daily session costs more than the subscription, the product does not exist. The
three levers, in order of effect:

1. **Cache verified content and share it.** A Grade 2 addition question is the same question
   for every Grade 2 child. Personalised content — a word problem about Ali's dog — is not
   cached. Most content is not personalised.
2. **Route to `FAST` wherever accuracy allows.**
3. **Keep the retrieved learner context short.** It is prepended to every turn, so its length
   is multiplied by every call the child makes.

Add a **per-student daily spend cap**. When it trips, Aria moves to cached content and
alerts us, not the child.

---

## 10. Latency

The rule from `master-plan.md` §4.1 stands: **the child never watches a model work.** Cloud
latency still exists, especially for an arbitrary child question, so the system hides work
where it can and acknowledges honestly where it cannot.

- **Pre-generate.** While the child works on question *n*, generate *n+1*. The wait is
  hidden behind their thinking time.
- **Design streaming now.** `LlmProvider` exposes an internal stream in Phase 0; the live
  voice runtime consumes it in Phase 2. Raw tokens never go to the browser. The tutor service
  assembles sentence-sized segments and releases each segment only after its applicable
  safety, level and correctness checks pass. Whole-item checks still buffer the full item.
- **Budget:** `FAST` under 1.5 s to first token; `TEACH` under 4 s total, always
  pre-generated when possible. Arrival acknowledgement is served without a model.

---

## 11. Privacy — what crosses the model-vendor boundary

Aria is a cloud product. Its own service holds account and learner data; configured model
vendors receive only the minimum scrubbed context required for a call. The rules are:

1. **Say it plainly at signup.** What is sent, to which vendor, and why. Not buried in a
   terms page.
2. **Never send identifying data to a model vendor.** The prompt carries a skill, grade
   band, recent evidence and the smallest relevant slice of learner memory. It does not
   carry the child's full name, school, address or parent email. A pseudonymous first name
   is allowed only when it materially changes the teaching.
3. **Retrieved learner context is scrubbed before it is sent.** Durable relationship memory
   is among the most sensitive data we hold. Strip anything a stranger could use to find
   the child and omit facts the parent has excluded from model personalisation.
4. **Use zero-retention API terms where the vendor offers them.** Contract for it. Record
   which endpoints have it in the config comments.
5. **The parent can inspect what was shared.** Provide the child-facing transcript and an
   understandable record of the learner context categories sent for each call; do not claim
   that a transcript alone is the complete internal prompt.
6. **Rules 4 to 9 of `master-plan.md` §12 are unchanged** — no advertising, no data sales,
   describe never label, delete means delete, crisis routing never depends on the model.

---

## 12. The golden sets — the reason this phase exists

Swapping providers is worthless if we cannot tell whether the new one is better. The
provider registry and both golden sets ship together in this phase.

- **Content set: 500 initial items**, human-graded, checked into the repository under
  `dev-docs/golden/content/`.
- Spread across subject, every grade band and representative skill families in the initial
  release scope. It grows before any new skill ships and is weighted toward arithmetic facts
  and decodable text, where a wrong answer does the most harm.
- Each item: input variables, the prompt name, and the graded expectation.
- **The harness runs the whole set against any endpoint** and reports: correctness,
  reading-level violations, markup leakage, safety flags, mean latency, and total cost.
- **Tutoring set: multi-turn scenarios**, under `dev-docs/golden/tutoring/`: arrival,
  confusion, interruption, fatigue, changed preferences, relevant recall, session resume
  and safety. Human tutors grade warmth, age fit, pedagogical choice and factual support.
- It runs on every prompt change and every model change. A regression blocks the change.

Together they prevent a model that writes good questions but conducts a bad conversation
from being called good enough.

---

## 13. Order of work

Each step is small and independently shippable. Do not batch them.

0. **The workspace exists and the carried-forward UI runs the new scripted event/move
   protocol.** See [`rewrite.md`](rewrite.md) §5, steps 1 to 3.
1. **`types.ts` and `config.ts`** — a new provider port with complete and internal-stream
   methods, plus config parsed and validated at boot. No calls yet.
2. **`adapters/openaiCompatible.ts`.** Point the config at one endpoint and make a real
   call.
3. **`adapters/anthropic.ts`**, with prompt-instructed JSON (prefill is rejected by Claude 4.6+).
4. **`routing.ts`** — tier routing, retry, fallback, circuit breaker. It becomes the only
   `LlmProvider` the app sees. Everything else talks to `AiClient`.
5. **The `ai_cost` migration** and cost accounting in the adapters.
6. **Sentence-segment gating and the small verified cache.** Prove that streamed tokens are
   not released directly to a child-facing consumer.
7. **Both golden sets and harnesses.** Run them against every configured endpoint. Read the
   results and pick the defaults.
8. **`health.ts`** — one cheap call per routed endpoint at boot, failing loudly.

### Exit test for Phase 0

> Changing which model teaches is one line of configuration. Running both golden sets
> against a new endpoint produces content, tutoring, latency and cost results without code
> changes. A test proves that no raw streamed token reaches a child-facing consumer. No
> runtime or configuration outside `legacy/` depends on Ollama.

---

## 14. Open questions

| Question | Why it matters | Who decides |
|---|---|---|
| Which vendor is the `TEACH` default? | Answer with the golden set, not with a preference. | Data |
| Do we build a desktop app at all, if it needs internet? | A web app may now be the better shape. Also tracked in [`rewrite.md`](rewrite.md) §6. | Product |
| Which speech and real-time providers sit behind the product-owned live protocol? | Phase 0 fixes the interface and gating rules; Phase 2 chooses providers from measured latency, interruption, accuracy, safety and cost. | Data + Engineering |

The desktop question is the important platform decision. The whole argument for an Electron app that bundles
its own runtime was that it worked offline with no account. Cloud-only removes that
argument, and the rewrite means nothing is carried forward by default. Decide deliberately,
rather than rebuilding the desktop shell from habit.
