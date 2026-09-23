import { GRADES, type Grade } from '@aria/shared';

/**
 * Development only: look at the picker as a child of another grade.
 *
 * The API honours the grade only in development, and this renders only in a development
 * build, so a child never sees it. It exists so that every subject at every grade from TK to 8
 * can be opened and tested without creating ten children.
 */
export function GradeOverride(props: {
  /** The grade the picker is showing; the child's own when nothing is chosen. */
  grade: Grade;
  onChange(grade: Grade | undefined): void;
}): React.JSX.Element | null {
  if (!import.meta.env.DEV) return null;
  return (
    <label className="grade-override">
      <span className="grade-override__tag">dev</span>
      Grade
      <select
        aria-label="Grade (development only)"
        onChange={(event) => {
          const chosen = GRADES.find((grade) => grade === event.target.value);
          props.onChange(chosen);
        }}
        value={props.grade}
      >
        {GRADES.map((grade) => (
          <option key={grade} value={grade}>
            {grade === 'TK' ? 'TK' : grade === 'K' ? 'K' : `Grade ${grade}`}
          </option>
        ))}
      </select>
    </label>
  );
}
