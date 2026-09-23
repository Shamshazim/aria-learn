# static_fallback_reaches_a_child — Aria is reading from a script

**The bar.** P2H-11: no static fallback reaches a child in a nominal session. The alert fires
when more than 1% of moves are canned text rather than something Aria generated for this child.

**What a child is experiencing.** Sentences that do not quite answer what they said, repeated
across turns and across sessions. Nothing looks broken — this is the failure that hides, which
is why it is alerted on rather than left to somebody noticing.

## Check, in this order

1. **Which reason?** `sum by (reason) (rate(fallback_used_total[5m]))`. The label is one of
   three and each is a different incident:
   - `ai_disabled` — no provider is configured. Check `AI_*` keys and `apps/api/config/ai.yaml`.
     In production this means a deploy lost its secrets.
   - `provider_error` — the vendor is failing. Check `/status` for breaker state and the
     `ai.endpoint.attempt` logs for the category (`auth`, `rate_limit`, `timeout`).
   - `gate_failed` — the model answered and the quality gate refused it. This is the serious
     one: it means generated text is unsafe or above the band's reading level, repeatedly.
2. **Which move kind?** `sum by (move) (rate(fallback_used_total[5m]))`. A single move kind
   points at that move's prompt (`ai/prompts/definitions/`), not at the provider.
3. **Which band?** Cross-reference `turns_total` by band. `gate_failed` concentrated in the
   early band usually means a prompt change raised the reading level past TK–2.

## What to do

- `ai_disabled` in production: this is an incident. Restore the key with `fly secrets set` and
  redeploy. Children are being taught from a script until you do.
- `provider_error`: P0-13's breaker and fallback endpoint should already be carrying it. If the
  fallback is also failing, both vendors are down — expected behaviour is the P0-25 calm screen,
  and the fix is out of our hands, so say so on the status page.
- `gate_failed`: find the rejected text in the `gate_rejection` log lines, which name the check
  and the measured value. If a prompt change caused it, revert the prompt. Do not relax the
  gate — it is the only thing standing between a model and a child.

**Do not** silence this alert during a vendor incident. The fallback working is not the same as
the product working, and the rate is what tells you how many children got a script today.
