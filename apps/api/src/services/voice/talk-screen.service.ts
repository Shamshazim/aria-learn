import type { TutorMove, VoiceScreenRequest } from '@aria/shared';

import { ValidationError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { MoveOutboxRepository } from '@/repositories/move-outbox.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import { createMoveFactory } from '@/services/moves/move-factory';
import { openTalkSession, type TalkGuardDeps } from '@/services/voice/talk-guard';

/**
 * The screen of a session where Aria talks.
 *
 * The realtime model asks for a surface — a writing pad, something to read, choices to tap —
 * and it becomes a `SHOW` move like any the text tutor makes: recorded in the session log,
 * queued in the outbox with a sequence number, and handed back for the worker to publish. The
 * browser renders it through the same registry as every other move, so the input control it
 * opens is chosen by `expects` and nothing here knows what a text area looks like.
 */
export type TalkScreenDeps = TalkGuardDeps &
  Readonly<{
    events: Pick<SessionEventRepository, 'append'>;
    outbox: Pick<MoveOutboxRepository, 'enqueueIfOpen'>;
    ids: IdGenerator;
    clock: Clock;
  }>;

export type TalkScreenService = Readonly<{
  show(sessionId: string, request: VoiceScreenRequest): Promise<TutorMove>;
}>;

export function createTalkScreenService(deps: TalkScreenDeps): TalkScreenService {
  return { show: (sessionId, request) => show(deps, sessionId, request) };
}

async function show(
  deps: TalkScreenDeps,
  sessionId: string,
  request: VoiceScreenRequest,
): Promise<TutorMove> {
  const session = await openTalkSession(deps, sessionId, request.connectionEpoch);
  const skillCode = session.plan.skillCode;
  const move = createMoveFactory({ ids: deps.ids, clock: deps.clock, sessionId: session.id }).make({
    kind: 'SHOW',
    ...surface(request),
    ...(typeof skillCode === 'string' && skillCode !== '' ? { skillId: skillCode } : {}),
  });
  await deps.events.append({
    sessionId: session.id,
    actor: 'aria',
    kind: move.kind,
    text: null,
    skillCode: typeof skillCode === 'string' && skillCode !== '' ? skillCode : null,
    correct: null,
    latencyMs: null,
    evidence: { source: 'realtime', surface: request.surface },
    payload: move,
    at: deps.clock.now(),
  });
  return (await deps.outbox.enqueueIfOpen(session.id, move)) ?? move;
}

/** What each surface puts on screen, and the control it opens. */
function surface(
  request: VoiceScreenRequest,
): Readonly<{ display: readonly Record<string, unknown>[]; expects: string }> {
  switch (request.surface) {
    case 'writing':
      return {
        display: [{ type: 'workpad', mode: 'answer', ...(request.text === undefined ? {} : { prompt: request.text }) }],
        expects: 'text',
      };
    case 'text':
      return { display: request.text === undefined ? [] : [{ type: 'text', body: request.text }], expects: 'none' };
    case 'number':
      return { display: request.text === undefined ? [] : [{ type: 'text', body: request.text }], expects: 'number' };
    case 'choices':
      return {
        display: [
          ...(request.text === undefined ? [] : [{ type: 'text', body: request.text }]),
          { type: 'choices', options: choiceOptions(request.options) },
        ],
        expects: 'choice',
      };
    case 'clear':
      return { display: [], expects: 'none' };
    default:
      return assertNever(request.surface);
  }
}

function choiceOptions(options: readonly string[] | undefined): readonly Record<string, string>[] {
  if (options === undefined) throw new ValidationError('a choices surface needs options');
  return options.map((label, index) => ({ id: String.fromCharCode(97 + index), label }));
}

function assertNever(value: never): never {
  throw new Error(`Unhandled screen surface: ${String(value)}`);
}
