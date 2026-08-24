import { Link } from 'react-router-dom';

import { bandForGrade, type Grade } from '@aria/shared';

import { AriaOwl } from '@/features/session';
import '@/features/session/styles/session.css';
import '@/features/session/styles/session-chrome.css';
import '@/features/session/styles/subject-picker.css';

const CLASSES: readonly Readonly<{
  grade: Grade;
  label: string;
  subject: string;
  emoji: string;
  note: string;
  theme: string;
}>[] = [
  {
    grade: '1',
    label: 'Grade 1',
    subject: 'Math',
    emoji: '🧮',
    note: 'Numbers, shapes and patterns.',
    theme: 'math',
  },
  {
    grade: '4',
    label: 'Grade 4',
    subject: 'Reading',
    emoji: '📖',
    note: 'Stories, sounds and new words.',
    theme: 'reading',
  },
  {
    grade: '7',
    label: 'Grade 7',
    subject: 'Science',
    emoji: '🔬',
    note: 'How the world actually works.',
    theme: 'science',
  },
];

export default function SubjectPickerPage(): React.JSX.Element {
  return (
    <div className="session-app class-picker-app" data-band="middle">
      <header className="session-topbar class-picker-topbar">
        <Link aria-label="Aria Learn" className="session-brand" to="/">
          <AriaOwl avatar size={34} /> Aria Learn
        </Link>
        <span className="class-picker-topbar__note">Your classes</span>
      </header>
      <main className="class-picker">
        <div className="class-picker__hello">
          <AriaOwl size={112} />
          <h1>Hello! What shall we do today?</h1>
          <p>Pick a class and I will take it from there.</p>
        </div>
        <div className="class-grid">
          {CLASSES.map((item) => (
            <Link
              className={`class-card class-card--${item.theme}`}
              aria-label={`${item.subject} ${item.label}`}
              data-band={bandForGrade(item.grade)}
              key={item.grade}
              to={`/session/${item.grade}/${item.subject.toLowerCase()}`}
            >
              <span aria-hidden="true" className="class-card__face">
                {item.emoji}
              </span>
              <strong>{item.subject}</strong>
              <span className="class-card__note">{item.note}</span>
              <small>{item.label}</small>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
