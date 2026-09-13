import { PROTOCOL_VERSION } from '../../version';

import type { EventKind } from '../events';
import type { MoveKind } from '../moves';

/**
 * One valid raw instance of every event and every move.
 *
 * Typed as `Record<EventKind, unknown>` and `Record<MoveKind, unknown>` on purpose: adding a
 * kind to either union without adding a fixture here is a compile error, so "every kind has a
 * fixture" is checked by the compiler; the count tests only pin the documented totals.
 *
 * The values are `unknown` because a fixture is *input* to a schema. Typing them as the
 * parsed type would assert what the test is supposed to prove.
 */

const base = {
  at: '2026-08-22T10:00:00Z',
  protocolVersion: PROTOCOL_VERSION,
  sessionId: 'ses_01',
  turnId: 'turn_01',
  connectionEpoch: 2,
} as const;

const eventBase = { ...base, acknowledgedSeq: 17 } as const;

const speech = { text: 'Ready when you are.', assetId: 'speech_ready_01' } as const;

const moveBase = {
  ...base,
  speech,
  display: [],
  expects: 'none',
  serverSeq: 18,
  causationId: 'evt_final',
  generationId: 'gen_01',
} as const;

/** P0-02 payloads: prove the one-version compatibility window stays open after P0-27. */
export const PREVIOUS_VERSION_EVENT_FIXTURE = {
  id: 'evt_previous_pause',
  at: '2026-08-22T10:00:00Z',
  sessionId: 'ses_01',
  protocolVersion: '1.0.0',
  kind: 'PAUSE',
} as const;

/** What P0-08's scripted source emits: a 1.0.0 move with none of the realtime fields. */
export const PREVIOUS_VERSION_MOVE_FIXTURE = {
  id: 'mov_previous_say',
  at: '2026-08-22T10:00:00Z',
  sessionId: 'ses_01',
  protocolVersion: '1.0.0',
  kind: 'SAY',
  speech: { text: 'Let us look at fractions.' },
  display: [],
  expects: 'none',
} as const;

/** A current-version event carrying none of the optional realtime fields. */
export const MINIMAL_CURRENT_EVENT_FIXTURE = {
  id: 'evt_minimal_pause',
  at: '2026-08-22T10:00:00Z',
  sessionId: 'ses_01',
  protocolVersion: PROTOCOL_VERSION,
  kind: 'PAUSE',
} as const;

export const EVENT_FIXTURES: Record<EventKind, unknown> = {
  ARRIVED: {
    ...eventBase,
    sessionId: undefined,
    id: 'evt_arrived',
    kind: 'ARRIVED',
    grade: '3',
  },
  SUBJECT_CHOSEN: {
    ...eventBase,
    id: 'evt_subject',
    kind: 'SUBJECT_CHOSEN',
    subjectId: 'math',
    grade: '3',
  },
  ANSWER: {
    ...eventBase,
    id: 'evt_answer',
    kind: 'ANSWER',
    respondsTo: 'mov_ask',
    choiceId: 'opt_b',
    elapsedMs: 4200,
  },
  QUESTION: { ...eventBase, id: 'evt_question', kind: 'QUESTION', text: 'Why is it four?' },
  CONFUSED: { ...eventBase, id: 'evt_confused', kind: 'CONFUSED', aboutMoveId: 'mov_say' },
  SKIP: {
    ...eventBase,
    id: 'evt_skip',
    kind: 'SKIP',
    respondsTo: 'mov_ask',
    reason: 'child_asked',
  },
  SPEECH_PARTIAL: {
    ...eventBase,
    id: 'evt_partial',
    kind: 'SPEECH_PARTIAL',
    text: 'I think it is',
    confidence: 0.6,
  },
  SPEECH_FINAL: {
    ...eventBase,
    id: 'evt_final',
    kind: 'SPEECH_FINAL',
    text: 'I think it is four',
    confidence: 0.95,
  },
  SILENCE: {
    ...eventBase,
    id: 'evt_silence',
    kind: 'SILENCE',
    waitedMs: 8000,
    afterMoveId: 'mov_ask',
  },
  INTERRUPT: {
    ...eventBase,
    id: 'evt_interrupt',
    kind: 'INTERRUPT',
    interruptedMoveId: 'mov_say',
  },
  BACKCHANNEL: { ...eventBase, id: 'evt_backchannel', kind: 'BACKCHANNEL' },
  SPEECH_STARTED: { ...eventBase, id: 'evt_speech_started', kind: 'SPEECH_STARTED' },
  MEDIA_LOST: { ...eventBase, id: 'evt_media_lost', kind: 'MEDIA_LOST' },
  MEDIA_RESTORED: { ...eventBase, id: 'evt_media_restored', kind: 'MEDIA_RESTORED' },
  PAUSE: { ...eventBase, id: 'evt_pause', kind: 'PAUSE' },
  RESUME: { ...eventBase, id: 'evt_resume', kind: 'RESUME' },
  LEAVE: { ...eventBase, id: 'evt_leave', kind: 'LEAVE', reason: 'done' },
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
    resumeOf: 'mov_interrupted',
    reflexes: { duckOnSpeech: true },
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
    vocabularyHint: ['quarters', 'whole'],
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
