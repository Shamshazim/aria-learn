import { useState } from 'react';

/**
 * A place to write more than a word: the pad Aria opens when she asks for a sentence or a
 * paragraph ("Aria talks", `show_on_screen`). The prompt above it is hers; what is typed goes
 * to her as an answer, and the pad says so, so a child knows the writing arrived.
 */
export function WritingPad(props: {
  prompt: string | null;
  large?: boolean;
  onAnswer: (value: string) => void;
}): React.JSX.Element {
  const [value, setValue] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const submit = (): void => {
    const text = value.trim();
    if (text === '') return;
    props.onAnswer(text);
    setSent(text);
    setValue('');
  };
  return (
    <form
      className={props.large === true ? 'writing-pad writing-pad--large' : 'writing-pad'}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {props.prompt === null ? null : (
        <label className="writing-pad__prompt" htmlFor="writing-pad">
          {props.prompt}
        </label>
      )}
      <textarea
        aria-label={props.prompt ?? 'Your writing'}
        autoComplete="off"
        id="writing-pad"
        onChange={(event) => {
          setValue(event.target.value);
        }}
        placeholder="Write here…"
        rows={props.large === true ? 3 : 5}
        value={value}
      />
      <div className="writing-pad__actions">
        <button disabled={value.trim() === ''} type="submit">
          Send to Aria
        </button>
        {sent === null ? null : (
          <output aria-live="polite" className="writing-pad__sent">
            Sent to Aria.
          </output>
        )}
      </div>
    </form>
  );
}
