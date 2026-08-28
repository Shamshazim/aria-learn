# 002 — LiveKit: Cloud or self-hosted

| | |
|---|---|
| **Status** | Proposed — needs the repo owner's approval in the X-01 pull request |
| **Date** | 2026-08-26 |
| **Ticket** | X-01 |
| **Depends on** | Decision 001 |

## The decision

**LiveKit Cloud, US region, with a signed data-processing agreement and recording disabled at
the project level.**

Self-hosting is deferred until there is a measured reason — cost per concurrent room, or a
data-residency requirement Cloud cannot meet.

## Why not self-host

An SFU is a real piece of infrastructure: TURN servers for the networks that block UDP, a
media path that has to be within tens of milliseconds of the child, and capacity planning
measured in concurrent audio streams. Running it ourselves means owning all of that before the
first child speaks to Aria, in exchange for a per-minute saving on traffic that does not exist
yet.

The reason to revisit is not philosophical. It is arithmetic: when the monthly Cloud bill
exceeds what a self-hosted deployment plus the time to operate it would cost, or when a school
district requires media never to leave a jurisdiction Cloud does not offer.

## What this commits us to, in privacy terms

This is the part that matters, because the audio is a child's voice.

- **Recording is off at the project level, not merely unused by our code.** A setting nothing
  in the application can turn on is a setting no future ticket can turn on by accident.
- **Media is transient.** Audio exists to be transcribed and is not written to durable storage
  by us or, per the agreement, retained by the vendor beyond the session. `P2-13`'s transient
  audio deletion is the application-side half of this.
- **The room name carries no identifying data.** A session id, never a child's nickname,
  never a student id that means anything outside our database — the same rule the model
  vendor boundary follows (P0-28: nothing identifying crosses a vendor boundary).
- **The entry goes in `voice-processor-map.md`** with the retention terms, alongside the
  model providers, because a parent asking "who hears my child" deserves one list.

## Region

`us-east`, matching the API's `iad` and Supabase's default. One region, chosen so the media
path and the tutor loop are not on opposite sides of an ocean from each other.

## Consequences

- Two vendor credentials per environment — `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET` — held
  in `fly secrets`, scoped per environment, never shared between staging and production.
- A LiveKit region outage is a voice outage, not a tutoring outage. The runbook's entry for it
  is: `/api/v1/health` reports voice as degraded, the web app offers the text and tap path
  (P2-07), and no child sees a broken microphone.
- Those two variables are **not** yet in `.env.example`. They arrive with the ticket that
  introduces the worker; `npm run check:env` will require them in every environment template
  on the day they do.
