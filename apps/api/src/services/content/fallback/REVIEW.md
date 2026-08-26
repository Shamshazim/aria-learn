# Fallback text — review record

Every static sentence a child can hear from Aria lives in this folder (P2H-11). Nothing here
is generated: these are the words she says when the model is off, the provider is down, or two
generations in a row failed the quality gate.

## Status

**Not yet reviewed by a person.** All variants are drafted and machine-checked; none has been
signed off. `fallback.test.ts` proves the mechanical properties — six or more per move per
band, every one passes the child-facing quality gate for its band, endings carry no digits, no
variant says "good job" or rates the child. It cannot prove that a real child hears warmth.

| Set | File | Variants | Reviewed |
| --- | --- | --- | --- |
| PRAISE, REVEAL, HINT, RETEACH, SWITCH | `feedback.data.ts` | 6 per band | pending |
| WELCOME, CHECK_IN, RECOMMEND, ASK, SHOW, LISTEN | `arrival.data.ts` | 6 per band | pending |
| BREAK, END | `closing.data.ts` | 6 per band | pending |
| SAY and its six approaches | `say.data.ts` | 6 per band | pending |
| Written-down session summary | `../../session/recap-text.ts` | 4 sentences | pending |

The last row is not child-facing: those sentences are written to `session.summary` for the
grown-ups who read a session back, and are never spoken. They are listed here because they are
still static text somebody has to have agreed to, and a reviewer looking for "everything Aria
says from a script" should not have to know they live somewhere else.

## What a reviewer is being asked

Read each set aloud in the band it belongs to and answer three questions:

1. Would a tutor say this to a child of this age, in this situation?
2. Does it hand the turn back rather than stopping the session dead?
3. Does it claim anything about the child that we do not know? A static string knows nothing
   about how the answer was reached, so it must not imply that it does.

Record the outcome by replacing `pending` with the reviewer and the date, in this file, in the
same commit as any wording change the review asks for.

## Why these are not the normal path

`fallback_used_total{move,reason}` fires every time one of these reaches a child, and the
acceptance bar for this phase is that a nominal session never fires it once. If this text is
being heard, something upstream is broken — a disabled provider, an outage, or a prompt whose
output keeps failing the gate. Improving the wording here is not the fix for that.
