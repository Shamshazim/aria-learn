# P0-11 — OpenAI-compatible adapter

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-10 |
| **Blocks** | P0-13 |
| **Parallel-safe with** | P0-12 |
| **Size** | M |

## Why

Most hosted vendors speak the OpenAI chat-completions wire format. One adapter plus a
different `base-url` covers OpenAI, Groq, Together, Fireworks, Mistral, DeepSeek, xAI,
OpenRouter, Azure OpenAI and Gemini's compatibility endpoint. This single file is most of
our vendor coverage.

## Scope

### Build
`adapters/openaiCompatible.ts` implementing `LlmProvider` for one configured endpoint, with
both `complete()` and `stream()`, the two known traps handled, and the defensive JSON
extractor.

### Do not build
No routing, retry, fallback or circuit breaker — P0-13. The adapter fails cleanly; it does
not decide what happens next.

## Design

```
apps/api/src/ai/provider/adapters/
  openai-compatible.ts       the adapter
  openai-compatible.types.ts vendor wire types (request/response), separate file
  json-extract.ts            defensive JSON extraction, shared with the Anthropic adapter
```

- `POST {base-url}/chat/completions`, header `Authorization: Bearer {key}`.
- Body: `model`, `messages` (system then user), `temperature`, `max_tokens`, and
  `response_format: {"type":"json_object"}` when `jsonMode` is true.
- Read `choices[0].message.content`, `usage.prompt_tokens`, `usage.completion_tokens`.

**Trap 1 — reasoning models.** The o-series and `gpt-5` reject any `temperature` other than
1 and want `max_completion_tokens` instead of `max_tokens`. Branch on the endpoint's
`reasoning: true` flag. Do not sniff the model name.

**Trap 2 — `response_format` is not universal.** Some compatible vendors reject it. On a
rejection, fall back to prompt-only JSON and use `json-extract.ts`, which strips code fences,
finds the outermost balanced object, and **rejects ambiguous output rather than guessing**.
An ambiguous extraction is an error, not a best-effort parse.

Both adapters must guarantee (`cloud-model-layer.md` §5.3):
- Never throw a raw HTTP error upward. Wrap in `AiError` with a category
  (`transport | rate_limit | auth | bad_request | content | timeout`) that P0-13 routes on.
- Never log the API key, the child's name, or the prompt body.
- Always return a populated `LlmResponse`, with `latencyMs` measured around the call and
  `costUsd` computed from the endpoint's `cost-per-mtok-*`.

## Acceptance criteria

- [ ] `complete()` returns a populated `LlmResponse` against a stubbed HTTP server.
- [ ] `stream()` yields chunks and a final usage record; the response text equals what
      `complete()` would have returned for the same stub.
- [ ] `reasoning: true` sends `max_completion_tokens` and omits `temperature`; a test proves
      the request body.
- [ ] A vendor rejecting `response_format` triggers the prompt-only path and still returns
      valid parsed JSON.
- [ ] `json-extract.ts` handles fenced JSON, leading prose and trailing prose, and **throws**
      on two candidate objects.
- [ ] 429, 500, 401 and a timeout each produce a distinct `AiError` category.
- [ ] A log-capture test proves no key, prompt body or name is ever logged.
- [ ] One manual live call against a real endpoint is recorded in the PR (no key in the log).

## Verification

```bash
npm run test -w @aria/api -- adapters/openai
```

## References

- `cloud-model-layer.md` §5.1, §5.3
