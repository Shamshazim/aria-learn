import { PROTOCOL_VERSION } from '../../version';

import type { EventKind } from '../events';
import type { MoveKind } from '../moves';

/**
 * One valid raw instance of every event and every move.
 *
 * Typed as `Record<EventKind, unknown>` and `Record<MoveKind, unknown>` on purpose: adding a
 * kind to either union without adding a fixture here is a compile error, so "all twelve
 * events and all fourteen moves exist" is checked by the compiler rather than by counting.
 *
 * The values are `unknown` because a fixture is *input* to a schema. Typing them as the
 * parsed type would assert what the test is supposed to prove.
 */

const base = {
  at: '2026-08-22T10:00:00Z',
  protocolVersion: PROTOCOL_VERSION,
  sessionId: 'ses_01',
} as const;

const speech = { text: 'Ready when you are.' } as const;

const moveBase = { ...base, speech, display: [], expects: 'none' } as const;

export const EVENT_FIXTURES: Record<EventKind, unknown> = {
  ARRIVED: { ...base, sessionId: undefined, id: 'evt_arrived', kind: 'ARRIVED', grade: '3' },
  SUBJECT_CHOSEN: {
    ...base,
    id: 'evt_subject',
    kind: 'SUBJECT_CHOSEN',
    subjectId: 'math',
    grade: '3',
  },
  ANSWER: {
    ...base,
    id: 'evt_answer',
    kind: 'ANSWER',
    respondsTo: 'mov_ask',
    choiceId: 'opt_b',
    elapsedMs: 4200,
  },
  QUESTION: { ...base, id: 'evt_question', kind: 'QUESTION', text: 'Why is it four?' },
  CONFUSED: { ...base, id: 'evt_confused', kind: 'CONFUSED', aboutMoveId: 'mov_say' },
  SPEECH_PARTIAL: {
    ...base,
    id: 'evt_partial',
    kind: 'SPEECH_PARTIAL',
    text: 'I think it is',
    confidence: 0.6,
  },
  SPEECH_FINAL: {
    ...base,
    id: 'evt_final',
    kind: 'SPEECH_FINAL',
    text: 'I think it is four',
    confidence: 0.95,
  },
  SILENCE: { ...base, id: 'evt_silence', kind: 'SILENCE', waitedMs: 8000, afterMoveId: 'mov_ask' },
  INTERRUPT: { ...base, id: 'evt_interrupt', kind: 'INTERRUPT', interruptedMoveId: 'mov_say' },
  PAUSE: { ...base, id: 'evt_pause', kind: 'PAUSE' },
  RESUME: { ...base, id: 'evt_resume', kind: 'RESUME' },
  LEAVE: { ...base, id: 'evt_leave', kind: 'LEAVE', reason: 'done' },
};

export const MOVE_FIXTURES: Record<MoveKind, unknown> = {
  WELCOME: {
    ...moveBase,
    id: 'mov_welcome',
    kind: 'WELCOME',
    speech: { text: 'Welcome back, Ajmal.' },
    basedOn: ['stuck with regrouping yesterday'],
  },
  CHECK_IN: { ...moveBase, id: 'mov_checkin', kind: 'CHECK_IN', about: 'mood', expects: 'choice' },
  RECOMMEND: {
    ...moveBase,
    id: 'mov_recommend',
    kind: 'RECOMMEND',
    subjectId: 'reading',
    grade: '3',
    reason: 'Reading is due today.',
    expects: 'choice',
  },
  SAY: {
    ...moveBase,
    id: 'mov_say',
    kind: 'SAY',
    skillId: 'fractions.equal_parts',
    display: [{ type: 'text', body: 'A fraction is a number of equal pieces.' }],
  },
  SHOW: {
    ...moveBase,
    id: 'mov_show',
    kind: 'SHOW',
    display: [{ type: 'visual', visual: 'number_line', alt: 'A number line from 0 to 1' }],
  },
  ASK: {
    ...moveBase,
    id: 'mov_ask',
    kind: 'ASK',
    itemId: 'item_01',
    expects: 'choice',
    display: [
      {
        type: 'choices',
        options: [
          { id: 'opt_a', label: '2' },
          { id: 'opt_b', label: '4' },
        ],
      },
    ],
  },
  LISTEN: {
    ...moveBase,
    id: 'mov_listen',
    kind: 'LISTEN',
    purpose: 'read_aloud',
    expects: 'speech',
    display: [{ type: 'passage', body: 'The cat sat on the mat.' }],
  },
  HINT: { ...moveBase, id: 'mov_hint', kind: 'HINT', attempt: 1, expects: 'choice' },
  RETEACH: {
    ...moveBase,
    id: 'mov_reteach',
    kind: 'RETEACH',
    misconception: 'adds numerators and denominators',
  },
  REVEAL: { ...moveBase, id: 'mov_reveal', kind: 'REVEAL', answer: '4' },
  PRAISE: {
    ...moveBase,
    id: 'mov_praise',
    kind: 'PRAISE',
    because: 'you checked the bottom number first',
  },
  SWITCH: {
    ...moveBase,
    id: 'mov_switch',
    kind: 'SWITCH',
    reason: 'This one is not landing today.',
  },
  BREAK: { ...moveBase, id: 'mov_break', kind: 'BREAK', reason: 'attention' },
  END: {
    ...moveBase,
    id: 'mov_end',
    kind: 'END',
    learned: ['equal parts make a fraction'],
    reason: 'complete',
  },
};
