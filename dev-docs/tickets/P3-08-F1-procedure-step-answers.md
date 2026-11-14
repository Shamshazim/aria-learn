# P3-08-F1 — Procedure items: collect and grade each step's answer

|                |                        |
| -------------- | ---------------------- |
| **Phase**      | 3 (finding from P3-08) |
| **Track**      | Backend + Tutor        |
| **Depends on** | P3-07 strand 3         |
| **Size**       | M                      |

## Why

P3-07 strand 3 made `procedure` items walk their steps: each stuck turn gets a hint at the
next step, and the answer is not revealed before every step has had a turn. The child still
answers the whole item each time, though. A right answer to "how many 4s go into 15?" is
graded against "39 r 1" and counts as wrong, and the step a child cannot do is inferred from
how far the hints got rather than measured.

## Scope

Keep the item open across a right step answer: the step hint becomes the answer target with
the step's own key (the ask evidence already allows a re-ask to override `answerKey`), a right
step is acknowledged and the next step asked, and the item closes on the final answer. The
`long-division` scenario gains a variant where the child gets steps 1 and 2 right and stalls on
step 3, and the session record names step 3.

## Acceptance

- A right step answer is graded right and moves to the next step, not to a new item.
- The stuck count and the step reached are both in the session record.
- The `REVEAL_BEFORE_STEPS` invariant and the procedure property test still hold.
