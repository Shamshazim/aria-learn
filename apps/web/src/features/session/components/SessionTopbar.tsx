import { Link } from 'react-router-dom';

import type { Band } from '@aria/shared';

import { AriaOwl } from '@/features/session/components/AriaOwl';
import { SessionIcon } from '@/features/session/components/SessionIcon';

/**
 * The child this session belongs to, as their own screen names them.
 *
 * `null` where the device holds no child session yet — a scripted scenario, a screenshot
 * test, the moment before the restore call answers. The name is then simply left out. It used
 * to be stood in for by a per-band invention (`Mia`, `Noah`, `Sofia`) carried over from the
 * first version's mock-ups, which meant a child could sit down in front of a screen that
 * greeted them by name, warmly, as somebody else.
 */
export type SessionLearner = Readonly<{ firstName: string }>;

/**
 * The two numbers beside the name are still per-band inventions.
 *
 * Nothing in the API reports a streak or a level, and `master-plan.md` §14 lists "a punishing
 * streak" among the things this product does not build — so they cannot be made real, only
 * removed. Left in place because removing chrome is a product decision, not a bug fix; named
 * honestly here so the next person does not mistake them for data.
 */
const BAND_PROGRESS: Readonly<Record<Band, Readonly<{ streak: number; level: number }>>> = {
  early: { streak: 7, level: 1 },
  middle: { streak: 12, level: 6 },
  senior: { streak: 31, level: 9 },
};

export function SessionTopbar({
  band,
  learner,
  subject,
}: {
  band: Band;
  learner: SessionLearner | null;
  subject: string;
}): React.JSX.Element {
  const progress = BAND_PROGRESS[band];
  return (
    <header className="session-topbar">
      <Link aria-label="Aria Learn" className="session-brand" to="/">
        <AriaOwl avatar size={34} /> Aria Learn
      </Link>
      <div className="session-topbar__middle">
        {band === 'senior' ? (
          <span>Today&apos;s focus: {focusFor(subject)}</span>
        ) : (
          <span className="session-learner">
            {learner === null ? null : <span aria-hidden="true">🙂</span>}
            {learner?.firstName}
            <small>· {subject}</small>
          </span>
        )}
      </div>
      <div className="session-topbar__right">
        <span aria-label={`${String(progress.streak)} day streak`}>🔥 {progress.streak}</span>
        {band === 'early' ? null : <span className="level-chip">Level {progress.level}</span>}
        {band === 'early' ? null : (
          <span aria-hidden="true" className="level-progress">
            <i />
          </span>
        )}
        {band === 'senior' && learner !== null ? (
          <span className="session-learner">
            <span aria-hidden="true">🙂</span> {learner.firstName}
          </span>
        ) : null}
        <span aria-hidden="true" className="session-topbar__rule" />
        <Link className="session-back" to="/choose">
          <SessionIcon name="back" size={18} /> Classes
        </Link>
      </div>
    </header>
  );
}

const FOCUS: Readonly<Record<string, string>> = {
  math: 'Counting on',
  mathematics: 'Mathematics',
  'math-adventures': 'Math Adventures',
  reading: 'Reading for meaning',
  writing: 'Writing',
  'english-writing': 'English Writing',
  science: 'Explaining what you notice',
};

function focusFor(subject: string): string {
  return FOCUS[subject.toLowerCase()] ?? subject;
}
