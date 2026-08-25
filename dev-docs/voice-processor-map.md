# Child-audio processor and deletion map

Launch status: **verification incomplete**. `VOICE_PRIVACY_SIGNOFF_ID` is required before a
production voice runtime can boot, but that identifier must point to a real signed review.

| Processor category                | Receives                                 | Aria retention                                        | Required evidence before launch                                         | Withdrawal action                                                         |
| --------------------------------- | ---------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| LiveKit media transport           | transient room audio                     | session recording is disabled (`record: false`)       | region and transport retention terms verified                           | close all open voice sessions                                             |
| Configured STT inference endpoint | transient child speech                   | Aria does not write conversational audio              | endpoint-specific zero-retention/abuse-monitoring terms verified        | processor deletion reference deleted when one exists                      |
| Configured TTS inference endpoint | gated spoken text only                   | reusable reviewed non-personal assets may be retained | text/audio storage terms and selected voice approved                    | no child-audio copy expected; delete referenced processor copy if present |
| Aria retained reading review      | only explicit purpose-bound opt-in audio | `retained_child_audio`, with mandatory expiry         | parent-facing purpose/expiry copy and storage deletion adapter verified | object deletion, processor-copy deletion, then tombstone                  |

Aria does not create voiceprints, speaker embeddings, biometric templates, emotion labels, or
prosody-derived durable evidence. Uncertain-speaker reading observations are marked ineligible
for durable evidence. Consent withdrawal closes active voice sessions before deletion begins;
failed idempotent deletions remain untombstoned so they can be retried.

The repository contains no write path for retained reading audio yet, so current child audio is
transient only. Retention must not be switched on until the expiry job, storage adapter, parent
transcript flags, processor deletion adapter, and counsel review are all live and tested.
