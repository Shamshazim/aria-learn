# P0-14 — AiClient and the prompt registry

| | |
|---|---|
| **Phase** | 0 — Foundation |
| **Track** | Backend |
| **Depends on** | P0-13 |
| **Blocks** | P0-18, P0-19, P0-20, P0-21, P1-06 |
| **Parallel-safe with** | P0-15, P0-16, P0-17 |
| **Size** | M |

## Why

`AiClient` is the only module outside the provider folder that touches `LlmProvider`. That
single seam is what makes the vendor a configuration detail. Everything else in the product —
the tutor loop, the quality gate, consolidation — talks to `AiClient` and named prompts, never
to a vendor.

## Scope

### Build
`AiClient`, a versioned prompt registry with typed inputs and typed parsed outputs, and the
generation call path that P0-18's quality gate will wrap.

### Do not build
- No quality gate. P0-18.
- No caching. P0-20.
- No tutor decisions. Phase 1.

## Design

```
apps/api/src/ai/
  client/
    ai-client.ts         the only caller of the routed LlmProvider
    ai-client.types.ts
  prompts/
    registry.ts          Record<PromptName, PromptDefinition>. Add a file, not a case.
    types.ts             PromptDefinition<Input, Output>: name, version, tier, system,
                         render(input), outputSchema (zod), maxTokens, jsonMode
    definitions/
      explain.prompt.ts
      hint.prompt.ts
      practice-item.prompt.ts
      grade-short-answer.prompt.ts
      classify-safety.prompt.ts
    render/
      render.ts          deterministic template rendering. No string concatenation in a
                         prompt definition.
```

Requirements:
- `AiClient.run(promptName, input)` renders the prompt, calls the routed provider at the
  prompt's tier, parses the response with the prompt's `outputSchema`, and returns a typed
  result plus the `LlmResponse` metadata. A parse failure is a typed error, never a partial
  object.
- **Prompts are versioned.** Every definition carries a `version`; it is recorded on every
  generation so a golden-set regression can be traced to the prompt change that caused it.
- **A prompt is data with a schema, not a string in a service.** No service composes prompt
  text inline.
- The tier is a property of the prompt (`cloud-model-layer.md` §6): `TEACH` for explanation,
  lesson generation, evaluation, the quality gate, consolidation and briefs; `FAST` for
  hints, short-answer grading, chat turns and classification. Moving a prompt to `FAST`
  requires a golden-set run — write that rule into the registry's module comment.
- `AiClient` accepts an `AbortSignal` and a per-call timeout and propagates both.
- Learner context passed in is already scrubbed by P0-23. `AiClient` asserts that it is
  calling with scrubbed context and refuses otherwise.

## Acceptance criteria

- [ ] Exactly one import of the routed provider exists outside `ai/provider/`, and it is in
      `ai-client.ts`; enforced by lint.
- [ ] Every prompt definition has a typed input, a zod output schema, a tier and a version.
- [ ] A malformed model response produces a typed parse error carrying the prompt name and
      version, and never a half-built object.
- [ ] Rendering is deterministic and unit tested against fixtures.
- [ ] The prompt version and endpoint name appear in the result metadata.
- [ ] Unscrubbed learner context is rejected with a typed error, proven by a test.
- [ ] No prompt text or rendered prompt body is logged.

## Verification

```bash
npm run test -w @aria/api -- ai/client ai/prompts
```

## References

- `cloud-model-layer.md` §3, §6
- `master-plan.md` §4.6
