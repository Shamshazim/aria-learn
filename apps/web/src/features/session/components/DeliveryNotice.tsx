import type { Band } from '@aria/shared';

import { DELIVERY_FAILURE_COPY } from '@/features/session/copy/failure.copy';

/** An answer Aria never received, with the one thing the child can do about it. */
export function DeliveryNotice(props: { band: Band; onRetry: () => void }): React.JSX.Element {
  return (
    <div className="delivery-notice" role="alert">
      <span>{DELIVERY_FAILURE_COPY[props.band]}</span>
      <button onClick={props.onRetry} type="button">
        Try again
      </button>
    </div>
  );
}
