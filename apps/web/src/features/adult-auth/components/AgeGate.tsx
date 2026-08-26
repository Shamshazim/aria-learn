import { useState } from 'react';

import { ADULT_ROLES } from '../model/adult-auth.machine';

import type { AdultRole } from '../api/adult-auth.api';

/**
 * The FTC age and role gate, shown after the link is clicked and before any account exists.
 *
 * The tick is unticked by default and the button is disabled until it is not: an attestation
 * that a visitor never actively made is not an attestation. Nothing is stored, here or on the
 * server, unless this form is submitted (COPPA/FTC — master-plan.md §12).
 */
export function AgeGate(
  props: Readonly<{
    submitting: boolean;
    onSubmit(input: Readonly<{ role: AdultRole; displayName?: string }>): void;
  }>,
): React.JSX.Element {
  const [confirmed, setConfirmed] = useState(false);
  const [role, setRole] = useState<AdultRole>('parent');
  const [displayName, setDisplayName] = useState('');

  const ready = confirmed && !props.submitting;

  return (
    <form
      className="adult-auth__form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        const name = displayName.trim();
        props.onSubmit({ role, ...(name === '' ? {} : { displayName: name }) });
      }}
    >
      <h1 className="adult-auth__title">One quick check</h1>

      <label className="adult-auth__check">
        <input
          checked={confirmed}
          onChange={(event) => {
            setConfirmed(event.target.checked);
          }}
          type="checkbox"
        />
        I am 18 or older and I am the parent, guardian or teacher of the children I will add.
      </label>

      <RoleChoice chosen={role} onChoose={setRole} />

      <label className="adult-auth__label" htmlFor="adult-name">
        What should Aria call you? (optional)
      </label>
      <input
        autoComplete="nickname"
        className="adult-auth__input"
        id="adult-name"
        maxLength={80}
        onChange={(event) => {
          setDisplayName(event.target.value);
        }}
        type="text"
        value={displayName}
      />

      <button className="adult-auth__button" disabled={!ready} type="submit">
        {props.submitting ? 'Signing in…' : 'Continue'}
      </button>
    </form>
  );
}

function RoleChoice(
  props: Readonly<{ chosen: AdultRole; onChoose(role: AdultRole): void }>,
): React.JSX.Element {
  return (
    <fieldset className="adult-auth__roles">
      <legend>I am a</legend>
      {ADULT_ROLES.map((option) => (
        <label className="adult-auth__radio" key={option}>
          <input
            checked={props.chosen === option}
            name="adult-role"
            onChange={() => {
              props.onChoose(option);
            }}
            type="radio"
            value={option}
          />
          {option === 'parent' ? 'Parent or guardian' : 'Teacher'}
        </label>
      ))}
    </fieldset>
  );
}
