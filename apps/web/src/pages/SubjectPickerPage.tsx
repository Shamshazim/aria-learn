import { Link } from 'react-router-dom';

import { bandForGrade, type Grade, type TutorMove } from '@aria/shared';

import { createApiClient } from '@/api';
import { webConfig } from '@/app/config';
import { createArrivalApi } from '@/features/arrival/api/arrival.api';
import { CheckInPrompt } from '@/features/arrival/components/CheckInPrompt';
import { RecommendationCard } from '@/features/arrival/components/RecommendationCard';
import { WelcomeBanner } from '@/features/arrival/components/WelcomeBanner';
import { useArrival } from '@/features/arrival/hooks/useArrival';
import type { ArrivalState } from '@/features/arrival/model/arrival.machine';
import { AriaOwl } from '@/features/session';
import '@/features/session/styles/session.css';
import '@/features/session/styles/session-chrome.css';
import '@/features/session/styles/subject-picker.css';

const arrivalApi = createArrivalApi(createApiClient({ baseUrl: webConfig.apiBaseUrl }));

const CLASSES: readonly Readonly<{
  subject: string;
  emoji: string;
  note: string;
  theme: string;
}>[] = [
  {
    subject: 'Math',
    emoji: '🧮',
    note: 'Numbers, shapes and patterns.',
    theme: 'math',
  },
  {
    subject: 'Reading',
    emoji: '📖',
    note: 'Stories, sounds and new words.',
    theme: 'reading',
  },
  {
    subject: 'Writing',
    emoji: '✍️',
    note: 'Words, sentences and stories.',
    theme: 'science',
  },
];

const PLACEHOLDER_CLASSES = [
  {
    subject: 'Math',
    emoji: '🧮',
    note: 'Numbers, shapes and patterns.',
    theme: 'math',
    grade: '1' as const,
  },
  {
    subject: 'Reading',
    emoji: '📖',
    note: 'Stories, sounds and new words.',
    theme: 'reading',
    grade: '4' as const,
  },
  {
    subject: 'Science',
    emoji: '🔬',
    note: 'How the world actually works.',
    theme: 'science',
    grade: '7' as const,
  },
];

export default function SubjectPickerPage(): React.JSX.Element {
  const arrival = useArrival(arrivalApi);
  const view = arrivalView(arrival.state);
  return (
    <div className="session-app class-picker-app" data-band={view.band}>
      <header className="session-topbar class-picker-topbar">
        <Link aria-label="Aria Learn" className="session-brand" to="/">
          {view.showOwl ? <AriaOwl avatar size={34} /> : null} Aria Learn
        </Link>
        <span className="class-picker-topbar__note">Your classes</span>
      </header>
      <main className="class-picker">
        <div aria-live="polite" className="class-picker__hello">
          {view.showOwl ? <AriaOwl size={112} /> : null}
          <WelcomeBanner move={view.welcome} />
        </div>
        <CheckInPrompt
          move={view.checkIn}
          selected={arrival.state.checkIn}
          onSelect={arrival.checkIn}
        />
        <div aria-busy={!view.choicesReady} className="class-grid">
          <RecommendationCard move={view.recommendation} href={view.recommendedHref} />
          {view.cards.map((card) => (
            <ClassCard key={`${card.grade}-${card.subject}`} card={card} />
          ))}
        </div>
      </main>
    </div>
  );
}

function availableClasses(band: 'early' | 'middle' | 'senior') {
  if (band === 'early') return CLASSES;
  if (band === 'middle') return CLASSES.filter((item) => item.subject !== 'Reading');
  return CLASSES.filter((item) => item.subject === 'Writing');
}

type CardView = Readonly<{
  grade: Grade;
  subject: string;
  emoji: string;
  note: string;
  theme: string;
  href: string | null;
}>;

function ClassCard({ card }: Readonly<{ card: CardView }>): React.JSX.Element {
  const content = (
    <>
      <span aria-hidden="true" className="class-card__face">
        {card.emoji}
      </span>
      <strong>{card.subject}</strong>
      <span className="class-card__note">{card.note}</span>
      <small>Grade {card.grade}</small>
    </>
  );
  const className = `class-card class-card--${card.theme}`;
  if (card.href === null) {
    return (
      <div aria-disabled="true" className={className} data-band={bandForGrade(card.grade)}>
        {content}
      </div>
    );
  }
  return (
    <Link
      aria-label={`${card.subject} Grade ${card.grade}`}
      className={className}
      data-band={bandForGrade(card.grade)}
      to={card.href}
    >
      {content}
    </Link>
  );
}

function arrivalView(state: ArrivalState) {
  if (state.status !== 'ready') {
    return {
      arrivalId: undefined,
      choicesReady: state.status === 'unavailable',
      grade: '4' as const,
      band: 'middle' as const,
      showOwl: true,
      welcome: null,
      checkIn: null,
      recommendation: null,
      recommendedHref: null,
      cards: placeholderCards(),
    };
  }
  const data = state.data;
  const recommendation = moveByKind(data.moves, 'RECOMMEND');
  return {
    arrivalId: data.arrivalId,
    choicesReady: true,
    grade: data.student.grade,
    band: data.student.band,
    showOwl: data.student.band !== 'senior',
    welcome: moveByKind(data.moves, 'WELCOME'),
    checkIn: moveByKind(data.moves, 'CHECK_IN'),
    recommendation,
    recommendedHref: recommendationHref(recommendation, data.arrivalId, state.checkIn),
    cards: availableClasses(data.student.band).map((item) => ({
      ...item,
      grade: data.student.grade,
      href: sessionHref(
        { grade: data.student.grade, subject: item.subject.toLowerCase() },
        data.arrivalId,
        false,
        state.checkIn,
      ),
    })),
  };
}

function placeholderCards(): readonly CardView[] {
  return PLACEHOLDER_CLASSES.map((item) => ({ ...item, href: null }));
}

function recommendationHref(
  recommendation: TutorMove | null,
  arrivalId: string,
  checkIn: string | null,
): string | null {
  if (recommendation?.kind !== 'RECOMMEND') return null;
  return sessionHref(
    { grade: recommendation.grade, subject: recommendation.subjectId },
    arrivalId,
    true,
    checkIn,
  );
}

function moveByKind(
  moves: readonly TutorMove[] | undefined,
  kind: TutorMove['kind'],
): TutorMove | null {
  return moves?.find((move) => move.kind === kind) ?? null;
}

function sessionHref(
  input: Readonly<{ grade: Grade; subject: string }>,
  arrivalId: string | undefined,
  recommended: boolean,
  checkIn: string | null,
): string {
  const query = new URLSearchParams();
  query.set('voice', '1');
  if (arrivalId !== undefined) query.set('arrivalId', arrivalId);
  if (recommended) query.set('recommended', '1');
  if (checkIn !== null) query.set('checkIn', checkIn);
  const suffix = query.size === 0 ? '' : `?${query.toString()}`;
  return `/session/${input.grade}/${input.subject}${suffix}`;
}
