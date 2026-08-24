import type { TutorMove } from '@aria/shared';

export function EarlyListen(props: { move: TutorMove }): React.JSX.Element {
  return (
    <div aria-label="Talk to Aria" className="early-listen" role="img">
      <span aria-hidden="true">🎤</span>
      <span className="visually-hidden">{props.move.speech?.text ?? 'Talk to me'}</span>
    </div>
  );
}
