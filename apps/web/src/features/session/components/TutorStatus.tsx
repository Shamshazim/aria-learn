import type { TutorStatus as Status } from '@/features/session/model/session-state';

const STATUS_COPY: Readonly<Record<Status, string>> = {
  thinking: 'Aria is thinking with you',
  speaking: 'Aria is explaining',
  listening: 'Aria is listening',
  waiting: 'Your turn',
};

export function TutorStatus(props: { status: Status }): React.JSX.Element {
  return (
    <p className="tutor-status visually-hidden" data-status={props.status} role="status">
      <span aria-hidden="true" className="tutor-status__mark" />
      {STATUS_COPY[props.status]}
    </p>
  );
}
