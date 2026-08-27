import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import type { ChildPicture, ChildSummary } from '@aria/shared';

import { ChildAvatar, ChildPicker, PictureLogin, PinPad, useAuth } from '@/features/auth';
import '@/features/auth/styles/auth.css';

/**
 * "Who is learning?", then whatever that child has to do to get in (P2H-12).
 *
 * Two steps on one screen rather than two routes, because a child who taps the wrong face has
 * to be able to go back without losing anything, and a back button is a browser concept before
 * it is a five-year-old's.
 */
export default function WhoIsLearningPage(): React.JSX.Element {
  const { state, signInChild, signOutParent } = useAuth();
  const [chosen, setChosen] = useState<ChildSummary | null>(null);

  if (state.child !== null) return <Navigate replace to="/" />;

  return (
    <main className="auth-page">
      <h1 className="auth-page__title">Who is learning?</h1>
      {chosen === null ? (
        <ChildPicker
          children={state.children}
          onChoose={(child) => {
            if (child.loginMethod === 'family-device') void signInChild({ childId: child.id });
            else setChosen(child);
          }}
        />
      ) : (
        <ChildStep
          busy={state.busy}
          child={chosen}
          problem={state.problem}
          onBack={() => {
            setChosen(null);
          }}
          onSubmit={(attempt) => {
            void signInChild({ childId: chosen.id, ...attempt });
          }}
        />
      )}
      <footer className="auth-page__footer">
        <Link to="/parent">Grown-ups</Link>
        <button type="button" onClick={signOutParent}>
          Sign this device out
        </button>
      </footer>
    </main>
  );
}

type ChildAttemptInput = Readonly<{ pin?: string; pictureSequence?: readonly ChildPicture[] }>;

/**
 * A locked child is told one fixed thing. Never a countdown: a six-year-old cannot do anything
 * with "try again in fourteen minutes" except feel worse about it.
 */
function ChildStep(
  props: Readonly<{
    busy: boolean;
    child: ChildSummary;
    problem: string | null;
    onBack(): void;
    onSubmit(attempt: ChildAttemptInput): void;
  }>,
): React.JSX.Element {
  const locked = props.problem === 'child-locked';
  return (
    <section className="auth-page__step">
      <p className="auth-page__who">
        <ChildAvatar picture={props.child.avatar} size={56} /> {props.child.firstName}
      </p>
      {locked ? (
        <p className="auth-page__problem" role="alert">
          Ask a grown-up for help.
        </p>
      ) : (
        <>
          {props.problem === null ? null : (
            <p className="auth-page__problem" role="alert">
              That is not quite it. Have another go.
            </p>
          )}
          {props.child.loginMethod === 'picture' ? (
            <PictureLogin
              disabled={props.busy}
              onSubmit={(pictureSequence) => {
                props.onSubmit({ pictureSequence });
              }}
            />
          ) : (
            <PinPad
              disabled={props.busy}
              onSubmit={(pin) => {
                props.onSubmit({ pin });
              }}
            />
          )}
        </>
      )}
      <button className="auth-page__back" type="button" onClick={props.onBack}>
        Not me
      </button>
    </section>
  );
}
