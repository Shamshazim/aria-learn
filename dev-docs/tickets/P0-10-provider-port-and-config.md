# P0-10 — LLM provider port and validated AI configuration

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-03 |
| **Blocks** | P0-11, P0-12, P0-13, P0-24 |
| **Parallel-safe with** | P0-04, P0-05 … P0-09 |
| **Size** | M |

## Why

Cloud-only must not mean vendor lock-in. One port, and a config file that decides which
hosted model serves which tier, is what makes "changing which model teaches is one line of
configuration" true — which is half the Phase 0 exit test.

## Scope

### Build
`types.ts` (the port and its request/response types) and `config.ts` (parse, resolve `${VAR}`,
validate, fail at boot), plus the checked-in `ai.yaml`.

### Do not build
No adapters, no routing, no calls. P0-11 through P0-13.

## Design

```
apps/api/src/ai/provider/
  types.ts        LlmProvider, LlmRequest, LlmResponse, ModelTier, StreamChunk
  config.ts       loadAiConfig() -> AiConfig. Throws a named error at boot.
  config.schema.ts  zod schema for the YAML shape
  index.ts
apps/api/config/ai.yaml
```

```ts
export type ModelTier = 'TEACH' | 'FAST'

export type LlmRequest = {
  tier: ModelTier
  system: string
  user: string
  maxTokens?: number
  temperature?: number
  jsonMode?: boolean
  timeoutMs?: number
  signal?: AbortSignal
}

export type LlmResponse = {
  text: string
  endpointName: string
  model: string
  tokensIn: number
  tokensOut: number
  costUsd: number          // computed by the adapter — see P0-15
  latencyMs: number        // measured around the call
  finishReason: 'stop' | 'length' | 'filtered' | 'error'
}

export interface LlmProvider {
  complete(req: LlmRequest): Promise<LlmResponse>
  /** Internal only. Raw chunks never leave the service — see P0-19. */
  stream(req: LlmRequest): AsyncIterable<StreamChunk>
}
```

Config shape and rules are `cloud-model-layer.md` §4, verbatim:

1. **Only endpoints named in `routing` are constructed.** An unreferenced endpoint block
   with no key is inert, so vendor blocks can stay in the file.
2. **A missing key for a routed endpoint fails at startup**, naming the endpoint and the
   environment variable. It never fails later, in front of a child.
3. **Keys come from the environment only.** Never a literal in the file, never in a log, an
   error message or the database.
4. **Both tiers may point at the same endpoint.** That is the simplest working setup.

Each endpoint carries `api`, `base-url`, `api-key`, `model`, `max-tokens`,
`timeout-seconds`, `cost-per-mtok-in`, `cost-per-mtok-out`, and optional `reasoning: true`
for the o-series and `gpt-5` (see P0-11).

## Acceptance criteria

- [ ] `ai.yaml` is checked in with anthropic, openai and a groq-style OpenAI-compatible
      endpoint, and no real key anywhere.
- [ ] `${VAR}` resolves from the environment; an unresolved variable on a routed endpoint
      throws at boot naming both the endpoint and the variable.
- [ ] An unreferenced endpoint with no key does not throw.
- [ ] An unknown `api` value, a negative cost, a missing model or a malformed URL are all
      rejected by the schema with a readable message.
- [ ] `AiConfig` is `z.infer` of the schema — no hand-written duplicate type.
- [ ] Unit tests cover every rule above.
- [ ] `.env.example` lists `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`.
- [ ] Nothing outside `ai/provider/` imports `LlmProvider` yet.

## Verification

```bash
npm run test -w @aria/api -- ai/provider
ANTHROPIC_API_KEY= npm run dev -w @aria/api   # must fail loudly and immediately
```

## References

- `cloud-model-layer.md` §3, §4
