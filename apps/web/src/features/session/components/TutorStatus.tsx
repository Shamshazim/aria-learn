import type { TutorStatus as Status } from '@/features/session/model/session-state';

const STATUS_COPY: Readonly<Record<Status, string>> = {
  thinking: 'Aria is thinking…',
  speaking: 'Aria is explaining',
  listening: 'Aria is listening',
  waiting: 'Your turn',
};

/**
 * Visible, in every band. It was hidden from sighted children once, and a tap that produced
 * nothing on screen for two seconds looked like a tap that had not worked.
 */
export function TutorStatus(props: { status: Status }): React.JSX.Element {
  return (
    <p className="tutor-status" data-status={props.status} role="status">
      <span aria-hidden="true" className="tutor-status__mark" />
      {STATUS_COPY[props.status]}
    </p>
  );
}
