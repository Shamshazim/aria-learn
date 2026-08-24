import type { MoveContent, TutorMove } from '@aria/shared';

export function MoveCard(props: { move: TutorMove }): React.JSX.Element {
  return (
    <article className="move-card" data-move-kind={props.move.kind}>
      {props.move.speech === null ? null : (
        <p className="session-speech">{props.move.speech.text}</p>
      )}
      {props.move.display.map((content, index) => (
        <DisplayContent content={content} key={`${content.type}-${String(index)}`} />
      ))}
    </article>
  );
}

function DisplayContent(props: { content: MoveContent }): React.JSX.Element {
  switch (props.content.type) {
    case 'text':
      return <p>{props.content.body}</p>;
    case 'choices':
      return <p>{props.content.options.map((option) => option.label).join(' · ')}</p>;
    case 'visual':
      return (
        <div aria-label={props.content.alt} className="move-visual" role="img">
          ● ● ●
        </div>
      );
    case 'passage':
      return <blockquote>{props.content.body}</blockquote>;
    case 'workpad':
      return <p>{props.content.prompt ?? 'Use the work pad to show your thinking.'}</p>;
    default:
      return assertNever(props.content);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled display content: ${String(value)}`);
}
