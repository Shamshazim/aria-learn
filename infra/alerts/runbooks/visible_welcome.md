# visible_welcome — the first screen is slow to appear

**The bar.** `master-plan.md` §11: the visible personalised welcome arrives in under 500ms at
the 95th percentile. The alert fires when the share of arrivals over 500ms burns the error
budget too fast.

**What a child is experiencing.** They opened Aria and are looking at nothing. This is the
first impression of every session, and unlike a slow turn there is no conversation in progress
to soften it.

## Check, in this order

1. **Arrival is not supposed to call a model.** `composeWelcome` and `recommend` are composed
   from stored evidence. If `planner_latency_ms` is moving in step with `arrival_ms`, something
   has put a model call on the arrival path — that is the bug, not the latency.
2. **Which band?** `sum by (band) (rate(arrival_ms_count[5m]))`. The early band composes the
   most from templates and should be the fastest.
3. **The context load.** Arrival reads the student, the last session, recent events, due skills
   and current facts — five queries. Check Postgres latency and whether any of them has lost an
   index after a migration.
4. **Is the catalogue being reloaded?** The class list comes from the curriculum inventory,
   which is read once at boot. A rising arrival time with flat database latency can mean it is
   being rebuilt per request.

## What to do

- Database: the five context queries are the whole budget. Confirm indexes on
  `session(student_id, started_at)` and `session_event(session_id, seq)` first.
- A model call on the arrival path: revert it. Arrival personalisation is from evidence, by
  design (P1-04), and moving it behind a model breaks this bar and §11's welcome promise at
  the same time.

**Do not** cache the welcome across sessions to make the number go down. It is personalised
from what happened last time, and a cached welcome is a wrong one.
