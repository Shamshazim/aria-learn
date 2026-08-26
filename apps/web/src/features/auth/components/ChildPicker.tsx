import type { ChildSummary } from '@aria/shared';

import { CHILD_PICTURE_ART } from '@/features/auth/components/child-pictures.data';
import { ChildAvatar } from '@/features/auth/components/ChildAvatar';

/**
 * "Who is learning?" — the first screen a child sees (P2H-12).
 *
 * A picture, a first name and a grade, in buttons big enough for a five-year-old's finger. The
 * grade is there for the family with two children called the same thing; the picture is there
 * for the child who cannot read either of the other two.
 */
export function ChildPicker({
  children,
  onChoose,
}: Readonly<{
  children: readonly ChildSummary[];
  onChoose(child: ChildSummary): void;
}>): React.JSX.Element {
  if (children.length === 0) {
    return (
      <p className="child-picker__empty">
        No one is set up on this tablet yet. A grown-up can add someone.
      </p>
    );
  }
  return (
    <ul className="child-picker" aria-label="Who is learning?">
      {children.map((child) => (
        <li key={child.id}>
          <button
            className="child-picker__child"
            type="button"
            onClick={() => {
              onChoose(child);
            }}
          >
            <ChildAvatar picture={child.avatar} size={72} />
            <span className="child-picker__name">{child.firstName}</span>
            <span className="child-picker__grade">
              Grade {child.grade} · {CHILD_PICTURE_ART[child.avatar].label}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
