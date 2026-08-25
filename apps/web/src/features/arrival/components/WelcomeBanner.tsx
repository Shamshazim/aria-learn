import type { TutorMove } from '@aria/shared';

export function WelcomeBanner(props: Readonly<{ move: TutorMove | null }>): React.JSX.Element {
  return (
    <>
      <h1>{props.move?.speech?.text ?? 'Hello! What shall we do today?'}</h1>
      <p>
        {props.move === null
          ? 'Pick a class and I will take it from there.'
          : 'Choose any class. The plan is always yours.'}
      </p>
    </>
  );
}
