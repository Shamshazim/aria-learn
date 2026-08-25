import type { Band } from '@aria/shared';

import { CONNECTION_FAILURE_COPY } from '@/features/session/copy/failure.copy';
import type { ConnectionStatus } from '@/features/session/model/connection-state';

export function ConnectionNotice(props: {
  band: Band;
  status: ConnectionStatus;
}): React.JSX.Element | null {
  if (props.status !== 'offline') return null;
  return (
    <p aria-live="polite" className="connection-notice" role="status">
      {CONNECTION_FAILURE_COPY[props.band]}
    </p>
  );
}
