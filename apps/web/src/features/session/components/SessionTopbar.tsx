import { Link } from 'react-router-dom';

import type { Band } from '@aria/shared';

import { AriaOwl } from '@/features/session/components/AriaOwl';
import { SessionIcon } from '@/features/session/components/SessionIcon';

const BAND_PROFILE: Readonly<
  Record<Band, Readonly<{ name: string; streak: number; level: number }>>
> = {
  early: { name: 'Mia', streak: 7, level: 1 },
  middle: { name: 'Noah', streak: 12, level: 6 },
  senior: { name: 'Sofia', streak: 31, level: 9 },
};

export function SessionTopbar({
  band,
  subject,
}: {
  band: Band;
  subject: string;
}): React.JSX.Element {
  const profile = BAND_PROFILE[band];
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
            <span aria-hidden="true">🙂</span> {profile.name}
            <small>· {subject}</small>
          </span>
        )}
      </div>
      <div className="session-topbar__right">
        <span aria-label={`${String(profile.streak)} day streak`}>🔥 {profile.streak}</span>
        {band === 'early' ? null : <span className="level-chip">Level {profile.level}</span>}
        {band === 'early' ? null : (
          <span aria-hidden="true" className="level-progress">
            <i />
          </span>
        )}
        {band === 'senior' ? (
          <span className="session-learner">
            <span aria-hidden="true">🙂</span> {profile.name}
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

function focusFor(subject: string): string {
  const normalized = subject.toLowerCase();
  if (normalized === 'math') return 'Counting on';
  if (normalized === 'reading') return 'Reading for meaning';
  if (normalized === 'science') return 'Explaining what you notice';
  return subject;
}
