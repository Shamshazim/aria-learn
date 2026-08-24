# P0-12 — Anthropic adapter

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-10 |
| **Blocks** | P0-13 |
| **Parallel-safe with** | P0-11 |
| **Size** | M |

## Why

Anthropic's Messages API differs enough from the chat-completions format to need its own
adapter, and it is the likely `TEACH` default — the tier where a wrong answer harms a child.

## Scope

### Build
`adapters/anthropic.ts` implementing `LlmProvider`, with `complete()`, `stream()` and
prompt-instructed JSON (see below).

### Do not build
No routing or resilience — P0-13.

## Design

```
apps/api/src/ai/provider/adapters/
  anthropic.ts           createAnthropicProvider + complete()
  anthropic.request.ts   request body, headers, error mapping
  anthropic.stream.ts    stream()
  anthropic.response.ts  stop_reason mapping onto the port
  anthropic.types.ts     wire types, separate file
  sse.ts, llm-response.ts   shared with the OpenAI-compatible adapter
```

- `POST {base-url}/v1/messages`
- Headers `x-api-key: {key}` and `anthropic-version: 2023-06-01`
- The system prompt is a **top-level `system` field**, not a message.
- `max_tokens` is **required** — take it from the request, else the endpoint default.
- Read `content[0].text`, `usage.input_tokens`, `usage.output_tokens`.

**There is no JSON mode, and no prefill either.** Claude 4.6 and later reject assistant
prefill with a 400, so the original prefill plan (still described in the first draft of
`cloud-model-layer.md` §5.2) is superseded: append "Return exactly one JSON object and no other
text." to the system prompt and extract the object from the reply with `json-extract.ts`, the
same prompt-only path P0-11 uses. Cover it with a test that proves the returned text is the
bare JSON object even when the model wraps it in prose or a code fence. Anthropic's structured
outputs need a schema the port does not carry yet; revisit when a ticket adds one.

Streaming uses the SSE `message_start` / `content_block_delta` / `message_delta` events;
usage arrives on `message_delta`, so `LlmResponse` totals are only final at stream end.

Same guarantees as P0-11: wrapped errors with a category, no key/prompt/name in logs, always
a populated `LlmResponse` with `latencyMs` and `costUsd`.

## Acceptance criteria

- [ ] `complete()` returns a populated `LlmResponse` against a stubbed server.
- [ ] The system prompt is sent as the top-level `system` field, proven by a request-body
      assertion.
- [ ] Omitting `max_tokens` is impossible: the adapter always sends one.
- [ ] `jsonMode` returns the bare JSON object, extracted from surrounding prose.
- [ ] `stream()` yields text deltas and reports final token usage from `message_delta`.
- [ ] 429 with `retry-after`, 529, 401 and a timeout each map to the right `AiError`
      category (`rate_limit`, `transport` — 529 and the in-stream `overloaded_error` are
      retryable like any other transport failure — `auth`, `timeout`), and `retry-after` is
      preserved for P0-13.
- [ ] A log-capture test proves no key, prompt body or name is ever logged.
- [ ] One manual live call recorded in the PR.

## Verification

```bash
npm run test -w @aria/api -- adapters/anthropic
```

## References

- `cloud-model-layer.md` §5.2, §5.3
