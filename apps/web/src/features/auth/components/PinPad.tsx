import { useState } from 'react';

import { PIN_LENGTH } from '@aria/shared';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;

/**
 * Four digits, for the bands that can read them (P2H-12).
 *
 * It submits itself on the fourth digit rather than asking for a second action: a child who
 * has typed their PIN has said everything they have to say, and an extra button is one more
 * thing to explain.
 */
export function PinPad({
  disabled = false,
  onSubmit,
}: Readonly<{ disabled?: boolean; onSubmit(pin: string): void }>): React.JSX.Element {
  const [pin, setPin] = useState('');

  const press = (key: string): void => {
    const next = `${pin}${key}`.slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) {
      setPin('');
      onSubmit(next);
    }
  };

  return (
    <div className="pin-pad">
      <p aria-live="polite" className="pin-pad__dots">
        <span className="visually-hidden">{`${String(pin.length)} of ${String(PIN_LENGTH)} digits entered`}</span>
        <span aria-hidden>{'●'.repeat(pin.length) + '○'.repeat(PIN_LENGTH - pin.length)}</span>
      </p>
      <div className="pin-pad__keys">
        {KEYS.map((key) => (
          <button
            key={key}
            className="pin-pad__key"
            disabled={disabled}
            type="button"
            onClick={() => {
              press(key);
            }}
          >
            {key}
          </button>
        ))}
        <button
          className="pin-pad__key pin-pad__key--undo"
          disabled={disabled || pin.length === 0}
          type="button"
          onClick={() => {
            setPin(pin.slice(0, -1));
          }}
        >
          Undo
        </button>
      </div>
    </div>
  );
}
