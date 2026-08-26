import { useState } from 'react';

import { PIN_LENGTH, type ChildSummary } from '@aria/shared';

import type { ChildProfileInput } from '@/features/auth/api/identity.api';
import { ChildAvatar } from '@/features/auth/components/ChildAvatar';

/**
 * One child, as a grown-up sees them (P2H-12).
 *
 * Everything a parent owns about a child is on this row: how they sign in, whether Aria may
 * say their name out loud, how it is pronounced, and whether this device is the family's.
 */
export function ChildSettingsRow({
  child,
  busy = false,
  onChange,
  onConsent,
}: Readonly<{
  child: ChildSummary;
  busy?: boolean;
  onChange(input: ChildProfileInput): void;
  onConsent?: () => void;
}>): React.JSX.Element {
  return (
    <li className="parent-children__child">
      <ChildAvatar picture={child.avatar} size={40} />
      <span className="parent-children__name">
        {child.firstName} · grade {child.grade}
      </span>
      <span className="parent-children__method">Signs in with: {child.loginMethod}</span>

      <PinField
        busy={busy}
        childId={child.id}
        onSave={(pin) => {
          onChange({ login: { pin } });
        }}
      />

      <label className="parent-children__field" htmlFor={`family-${child.id}`}>
        <input
          checked={child.loginMethod === 'family-device'}
          disabled={busy}
          id={`family-${child.id}`}
          type="checkbox"
          onChange={(event) => {
            onChange({ login: { familyDevice: event.target.checked } });
          }}
        />
        Family device — no PIN needed here
      </label>

      {onConsent === undefined ? null : (
        <button
          className="parent-children__action"
          disabled={busy}
          type="button"
          onClick={onConsent}
        >
          Allow talking out loud
        </button>
      )}
    </li>
  );
}

/** Setting a PIN, which is the one edit on this row that has a value of its own to hold. */
function PinField({
  busy,
  childId,
  onSave,
}: Readonly<{ busy: boolean; childId: string; onSave(pin: string): void }>): React.JSX.Element {
  const [pin, setPin] = useState('');
  return (
    <>
      <label className="parent-children__field" htmlFor={`pin-${childId}`}>
        New PIN
        <input
          id={`pin-${childId}`}
          inputMode="numeric"
          maxLength={PIN_LENGTH}
          pattern="\d*"
          value={pin}
          onChange={(event) => {
            setPin(event.target.value.replace(/\D/gu, '').slice(0, PIN_LENGTH));
          }}
        />
      </label>
      <button
        className="parent-children__action"
        disabled={busy || pin.length !== PIN_LENGTH}
        type="button"
        onClick={() => {
          onSave(pin);
          setPin('');
        }}
      >
        Save PIN
      </button>
    </>
  );
}
