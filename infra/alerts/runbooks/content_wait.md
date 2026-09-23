# content_wait — a child is waiting for Aria

**The bar.** `master-plan.md` §11: a child waits for content for less than one second at the
95th percentile. The alert fires when the share of turns over 1 000ms is burning the error
budget faster than it can be sustained.

**What a child is experiencing.** A pause after they answer. In the early band that is long
enough for a five-year-old to look away; in the middle and senior bands it reads as the tutor
not having heard them. It is not an outage, so nothing else will tell you about it.

## Check, in this order

1. **Is it one band or all three?** `sum by (band) (rate(turn_content_ms_count[5m]))` against
   the bucket ratio. One band is a content or prompt problem for that band; all three is
   infrastructure or a vendor.
2. **Is the model slow, or is it us?** Compare `turn_content_ms` with `planner_latency_ms` and
   the endpoint attempt logs (`event: ai.endpoint.attempt`). If the planner accounts for the
   whole difference, this is a vendor latency problem, not ours.
3. **Is the primary endpoint failing over?** `planner_decision_total{reason="planner_error"}`
   and the breaker state on `/status`. A fallback to a slower endpoint shows up here before it
   shows up anywhere else.
4. **Is the gate rejecting and retrying?** `gate_rejections_total` rising with latency means
   generated text is failing the readability or safety check and being regenerated.
5. **Is the database slow?** Turn commit is in the span. Check Postgres connection saturation
   against `DB_POOL_MAX`.

## What to do

- Vendor latency: P0-13's routing already fails over. If the fallback is also slow, lower
  `timeout-seconds` for the primary in `apps/api/config/ai.yaml` so the failover happens sooner.
- Gate thrash: look at what is being rejected. A prompt change that pushed text above the band
  reading level is the usual cause, and rolling it back is faster than tuning it live.
- Database: scale the pool or the instance. Do not raise the statement timeout.

**Do not** raise the SLO threshold to clear the alert. The number is from the plan.
