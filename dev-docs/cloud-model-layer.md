# The Model Layer — Cloud Only

**Status:** design agreed, not yet implemented. Revised 2026-08-22 for the rewrite.
**Phase:** 0 (Foundation) of [`master-plan.md`](master-plan.md). Nothing else starts until
this ships.
**Owner decision, 2026-08-21:** *"We only support cloud models for now. No local models."*

**Read first:** [`rewrite.md`](rewrite.md). This document was written against the Java code
base, which is now frozen under `legacy/`. The design below is unchanged and correct — the
port, the two adapters, the tier routing, the cost and failure handling. What changed is
that it gets **built, not migrated**: every Java class named here is a TypeScript module to
write in `apps/api`, and every "delete this" instruction is now simply "never write it".

---

## 1. The decision, in one paragraph

Aria calls a **hosted model over the network**. There is no bundled Ollama, no local
weights, no offline mode. The reason is simple: `qwen2.5:7b` cannot teach. It writes
arithmetic that is wrong, it writes HTML into question text, and it takes 6 to 38 seconds
to do it. A tutor that is sometimes wrong about 7 + 8 is not a tutor. We would rather ship
a product that needs internet and is genuinely good than one that works on a plane and
teaches a child the wrong thing.

We still keep the **provider port** we already have. Being cloud-only is not the same as
being locked to one vendor. Any hosted model must plug in through configuration alone.

---

## 2. What this changes

| Area | Before | After |
|---|---|---|
| Engine | Bundled Ollama, private dynamic port | HTTPS call to a hosted API |
| Offline | Full offline promise | **Gone.** Aria needs internet |
| Packaging | Electron bundling JRE + PostgreSQL + Ollama (~5 GB) | A web app calling a hosted API. See [`rewrite.md`](rewrite.md) §6. |
| Data location | Nothing left the machine | Prompt text leaves the machine |
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

Everything under `legacy/` that implements the above — `ai/provider/OllamaLlmProvider.java`,
`OllamaProperties.java`, `desktop/src/services/ollama.js` — stays frozen and unread.

---

## 3. The design

The shape below is the design, written originally in Java names. **Build it in TypeScript
in `apps/api`.** `AiClient` is the only module outside the provider folder that touches
`LlmProvider` — everything else in the codebase talks to `AiClient`. That single seam is
what makes the vendor a configuration detail.

```
AiClient
   │  provider.complete(LlmRequest)
   ▼
RoutingLlmProvider          ← the single Spring bean of type LlmProvider
   │  picks an endpoint by ModelTier, with fallback
   ▼
LlmProviderFactory          ← builds one adapter per configured endpoint, at startup
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

The Java names in the diagram above map one-to-one onto these. Where this document says
`RoutingLlmProvider`, read `routing.ts`.

---

## 4. Configuration

One block. Adding a vendor is a config change and an API key. It is never a code change,
unless the vendor speaks a wire format we do not have an adapter for.

The YAML below is the *shape*, carried over from the Spring design. In the Node rewrite it
becomes a checked-in `apps/api/config/ai.yaml` (or the equivalent TypeScript module) parsed
and validated at boot by `config.ts`, with `${VAR}` resolved from the environment. The
structure, the rules under it, and the startup-failure behaviour are unchanged.

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
and rely on `AiClient.extractJson()`, which already strips fences.

### 5.2 `AnthropicProvider`

- `POST {base-url}/v1/messages`
- Headers `x-api-key: {key}` and `anthropic-version: 2023-06-01`
- The system prompt is a **top-level `system` field**, not a message.
- `max_tokens` is **required**.
- Read `content[0].text`, `usage.input_tokens`, `usage.output_tokens`.

**There is no JSON mode.** Use assistant prefill: append a final message
`{"role":"assistant","content":"{"}`, then prepend `{` back onto the returned text before
handing it to `AiClient`. This is reliable and costs nothing.

### 5.3 What both must guarantee

- Never throw a raw HTTP exception upward. Wrap in `AiException`.
- Never put the API key, the child's name, or the prompt body into a log line.
- Always return a populated `LlmResponse`, including `latencyMs` measured around the call.

---

## 6. Tier routing

`ModelTier` stays a two-value enum, and it is the whole cost-control lever.

| Tier | Used for | Wants |
|---|---|---|
| `TEACH` | explanation, lesson generation, evaluation, the quality gate, the learner model | Accuracy. This is where a wrong answer harms a child. |
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
3. **Cache.** The content cache from `master-plan.md` §4.4 already holds verified,
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
3. **Keep the learner-model paragraph short.** It is prepended to every turn, so its length
   is multiplied by every call the child makes.

Add a **per-student daily spend cap**. When it trips, Aria moves to cached content and
alerts us, not the child.

---

## 10. Latency

The hard rule from `master-plan.md` §4.1 stands: **the child never waits for a model.**
Cloud is faster than the old local engine, but the network is not free.

- **Pre-generate.** While the child works on question *n*, generate *n+1*. The wait is
  hidden behind their thinking time.
- **Stream the `SAY` moves.** Aria's speech should start playing as tokens arrive, not
  after the whole paragraph completes. This needs a streaming path through the adapters —
  design `LlmProvider` to allow it now, even if we implement it in Phase 3 with voice.
- **Budget:** `FAST` under 1.5 s to first token; `TEACH` under 4 s total, always
  pre-generated so the child never sees it.

---

## 11. Privacy — what now leaves the machine

The old promise was "no child data leaves the machine". That promise is gone and we must
not pretend otherwise. The new rules:

1. **Say it plainly at signup.** What is sent, to which vendor, and why. Not buried in a
   terms page.
2. **Never send identifying data.** The prompt carries a skill, a grade band, recent errors,
   and the learner-model paragraph. It does not carry the child's full name, their school,
   their address, or their parent's email. A pseudonymous first name only, and only where
   it changes the teaching.
3. **The learner model is scrubbed before it is sent.** It is written for teaching, and it
   is the most sensitive text we hold. Strip anything a stranger could use to find the
   child.
4. **Use zero-retention API terms where the vendor offers them.** Contract for it. Record
   which endpoints have it in the config comments.
5. **The parent can read every prompt we sent.** Full transcript, unedited.
6. **Rules 4 to 9 of `master-plan.md` §12 are unchanged** — no advertising, no data sales,
   describe never label, delete means delete, crisis routing never depends on the model.

---

## 12. The golden set — the reason this phase exists

Swapping providers is worthless if we cannot tell whether the new one is better. The
provider registry and the golden set ship together, in this phase.

- **500 items**, human-graded, checked into the repository under `dev-docs/golden/`.
- Spread across subject, grade band and prompt name. Weighted toward arithmetic facts and
  decodable text, where a wrong answer does the most harm.
- Each item: input variables, the prompt name, and the graded expectation.
- **The harness runs the whole set against any endpoint** and reports: correctness,
  reading-level violations, markup leakage, safety flags, mean latency, and total cost.
- It runs on every prompt change and every model change. A regression blocks the change.

This is what turns "the model is not good enough" from an opinion into a number.

---

## 13. Order of work

Each step is small and independently shippable. Do not batch them.

0. **The workspace exists and the session UI runs on mocks.** See
   [`rewrite.md`](rewrite.md) §5, steps 1 and 2. This work has no home until then.
1. **`types.ts` and `config.ts`** — the port, and the config block parsed and validated at
   boot. No calls yet.
2. **`adapters/openaiCompatible.ts`.** Point the config at one endpoint and make a real
   call.
3. **`adapters/anthropic.ts`**, with the prefill trick.
4. **`routing.ts`** — tier routing, retry, fallback, circuit breaker. It becomes the only
   `LlmProvider` the app sees. Everything else talks to `AiClient`.
5. **The `ai_cost` migration** and cost accounting in the adapters.
6. **The golden set and harness.** Run it against every configured endpoint. Read the table.
   Pick the default.
7. **`health.ts`** — one cheap call per routed endpoint at boot, failing loudly.

### Exit test for Phase 0

> Changing which model teaches is one line of configuration. Running the golden set against
> a new endpoint produces a correctness, latency and cost number without any code change.
> No file outside `legacy/` mentions Ollama, and none ever will.

---

## 14. Open questions

| Question | Why it matters | Who decides |
|---|---|---|
| Proxy or bring-your-own-key? | Section 7 says proxy. It makes an account mandatory. | Product |
| Which vendor is the `TEACH` default? | Answer with the golden set, not with a preference. | Data |
| Do we build a desktop app at all, if it needs internet? | A web app may now be the better shape. Also tracked in [`rewrite.md`](rewrite.md) §6. | Product |
| Streaming in Phase 0 or Phase 3? | The adapter shape depends on the answer. | Engineering |

The third question is the important one. The whole argument for an Electron app that bundles
its own runtime was that it worked offline with no account. Cloud-only removes that
argument, and the rewrite means nothing is carried forward by default. Decide deliberately,
rather than rebuilding the desktop shell from habit.
