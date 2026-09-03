import type { Band, MoveContent, TutorMove } from '@aria/shared';

import { AriaOwl, type OwlMood } from '@/features/session/components/AriaOwl';
import { SessionIcon } from '@/features/session/components/SessionIcon';

export function MoveCard(props: { band: Band; move: TutorMove }): React.JSX.Element {
  return (
    <article className="move-card" data-move-kind={props.move.kind}>
      {props.move.speech === null ? null : (
        <div className="session-speech-row">
          {props.band === 'middle' ? <AriaOwl mood={moodFor(props.move)} size={78} /> : null}
          {props.band === 'senior' ? <AriaOwl avatar mood={moodFor(props.move)} size={40} /> : null}
          <p className="session-speech">{props.move.speech.text}</p>
          <button
            aria-label="Read this out loud (available in the voice phase)"
            className="speech-replay"
            disabled
            type="button"
          >
            <SessionIcon name="speaker" size={22} />
          </button>
        </div>
      )}
      <div className="move-content">
        {props.move.display.map((content, index) => (
          <DisplayContent content={content} key={`${content.type}-${String(index)}`} />
        ))}
      </div>
    </article>
  );
}

function DisplayContent(props: { content: MoveContent }): React.JSX.Element | null {
  switch (props.content.type) {
    case 'text':
      return <p>{props.content.body}</p>;
    case 'choices':
      return null;
    case 'visual':
      return <VisualContent content={props.content} />;
    case 'passage':
      return <blockquote>{props.content.body}</blockquote>;
    case 'workpad':
      // In answer mode the input surface draws the pad with its prompt; here would be twice.
      if (props.content.mode === 'answer') return null;
      return (
        <p className="workpad-prompt">
          {props.content.prompt ?? 'Use the work pad to show your thinking.'}
        </p>
      );
    default:
      return assertNever(props.content);
  }
}

function VisualContent(props: {
  content: Extract<MoveContent, { type: 'visual' }>;
}): React.JSX.Element {
  if (props.content.visual === 'dot-groups') return <DotGroups content={props.content} />;
  return <p className="visual-description">{props.content.alt}</p>;
}

function DotGroups(props: {
  content: Extract<MoveContent, { type: 'visual' }>;
}): React.JSX.Element {
  const first = countParam(props.content.params, 'first', 4);
  const second = countParam(props.content.params, 'second', 3);
  return (
    <div aria-label={props.content.alt} className="dot-groups" role="img">
      <DotGroup count={first} />
      <span aria-hidden="true" className="dot-groups__plus">
        +
      </span>
      <DotGroup count={second} />
    </div>
  );
}

function DotGroup({ count }: { count: number }): React.JSX.Element {
  return (
    <span className="dot-group">
      {Array.from({ length: count }, (_, index) => (
        <i aria-hidden="true" key={index} />
      ))}
    </span>
  );
}

function countParam(
  params: Readonly<Record<string, unknown>>,
  name: string,
  fallback: number,
): number {
  const value = params[name];
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 12
    ? value
    : fallback;
}

function moodFor(move: TutorMove): OwlMood {
  if (move.kind === 'PRAISE') return 'cheer';
  if (move.kind === 'HINT' || move.kind === 'RETEACH' || move.kind === 'REVEAL') return 'think';
  return 'idle';
}

function assertNever(value: never): never {
  throw new Error(`Unhandled display content: ${String(value)}`);
}
