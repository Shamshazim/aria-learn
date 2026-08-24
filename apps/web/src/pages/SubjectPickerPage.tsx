import { Link } from 'react-router-dom';

import { bandForGrade, type Grade } from '@aria/shared';

import { AriaOwl } from '@/features/session';
import '@/features/session/styles/session.css';

const CLASSES: readonly Readonly<{
  grade: Grade;
  label: string;
  subject: string;
  emoji: string;
}>[] = [
  { grade: '1', label: 'Grade 1', subject: 'Math', emoji: '🔢' },
  { grade: '4', label: 'Grade 4', subject: 'Reading', emoji: '📚' },
  { grade: '7', label: 'Grade 7', subject: 'Science', emoji: '🔬' },
];

export default function SubjectPickerPage(): React.JSX.Element {
  return (
    <main className="class-picker">
      <div className="class-picker__hello">
        <AriaOwl large />
        <div>
          <h1>Hello! What shall we do today?</h1>
          <p>Pick a class and I will take it from there.</p>
        </div>
      </div>
      <div className="class-grid">
        {CLASSES.map((item) => (
          <Link
            className="class-card"
            data-band={bandForGrade(item.grade)}
            key={item.grade}
            to={`/session/${item.grade}/${item.subject.toLowerCase()}`}
          >
            <span aria-hidden="true">{item.emoji}</span>
            <strong>{item.subject}</strong>
            <small>{item.label}</small>
          </Link>
        ))}
      </div>
    </main>
  );
}
