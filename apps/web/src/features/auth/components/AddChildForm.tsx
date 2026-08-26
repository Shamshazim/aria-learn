import { useState } from 'react';

import {
  CHILD_PICTURES,
  GRADES,
  childPictureSchema,
  gradeSchema,
  type ChildPicture,
  type Grade,
} from '@aria/shared';

import { CHILD_PICTURE_ART } from '@/features/auth/components/child-pictures.data';

/** Adding a child: a name, a grade and the picture they will look for (P2H-12). */
export function AddChildForm({
  busy = false,
  onSubmit,
}: Readonly<{
  busy?: boolean;
  onSubmit(input: Readonly<{ displayName: string; grade: Grade; avatar: ChildPicture }>): void;
}>): React.JSX.Element {
  const [displayName, setDisplayName] = useState('');
  const [grade, setGrade] = useState<Grade>('1');
  const [avatar, setAvatar] = useState<ChildPicture>('fox');

  return (
    <form
      className="parent-children__add"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ displayName, grade, avatar });
        setDisplayName('');
      }}
    >
      <NameField value={displayName} onChange={setDisplayName} />
      <Choice
        id="child-grade"
        label="Grade"
        options={GRADES.map((option) => ({ value: option, label: option }))}
        value={grade}
        onChange={(raw) => {
          // Parsed, not asserted: a `select` is still input, and §1 makes no exception for
          // input whose options we happened to render ourselves.
          const parsed = gradeSchema.safeParse(raw);
          if (parsed.success) setGrade(parsed.data);
        }}
      />
      <Choice
        id="child-avatar"
        label="Picture"
        options={CHILD_PICTURES.map((option) => ({
          value: option,
          label: CHILD_PICTURE_ART[option].label,
        }))}
        value={avatar}
        onChange={(raw) => {
          const parsed = childPictureSchema.safeParse(raw);
          if (parsed.success) setAvatar(parsed.data);
        }}
      />
      <button className="parent-children__action" disabled={busy} type="submit">
        Add child
      </button>
    </form>
  );
}

/** A labelled `select`. Private to this form; the shared UI kit is not this ticket's to grow. */
function Choice(
  props: Readonly<{
    id: string;
    label: string;
    options: readonly Readonly<{ value: string; label: string }>[];
    value: string;
    onChange(value: string): void;
  }>,
): React.JSX.Element {
  return (
    <label className="parent-children__field" htmlFor={props.id}>
      {props.label}
      <select
        id={props.id}
        value={props.value}
        onChange={(event) => {
          props.onChange(event.target.value);
        }}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The child's first name. Bounded here at the length the database bounds it at. */
function NameField({
  value,
  onChange,
}: Readonly<{ value: string; onChange(value: string): void }>): React.JSX.Element {
  return (
    <label className="parent-children__field" htmlFor="child-name">
      First name
      <input
        id="child-name"
        maxLength={64}
        required
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </label>
  );
}
