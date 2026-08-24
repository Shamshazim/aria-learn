import { useState } from 'react';

import type { Band } from '@aria/shared';

import { AriaOwl } from '@/features/session/components/AriaOwl';
import { SessionIcon } from '@/features/session/components/SessionIcon';

export function AskAriaPanel(props: {
  band: Exclude<Band, 'early'>;
  onQuestion: (text: string) => void;
}): React.JSX.Element {
  const [draft, setDraft] = useState('');
  return (
    <aside aria-label="Ask Aria" className="aria-chat">
      <h2>{props.band === 'senior' ? 'Aria' : 'Ask Aria'}</h2>
      <div aria-live="polite" className="aria-chat__body">
        <div className="aria-chat__turn">
          <AriaOwl avatar size={32} />
          <p>I am right here. Ask me anything, any time.</p>
        </div>
      </div>
      <form
        className="aria-chat__input"
        onSubmit={(event) => {
          event.preventDefault();
          const question = draft.trim();
          if (question.length === 0) return;
          props.onQuestion(question);
          setDraft('');
        }}
      >
        <input
          aria-label="Question for Aria"
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          placeholder={props.band === 'senior' ? 'Ask Aria anything' : 'Ask me anything'}
          value={draft}
        />
        <button aria-label="Send question" disabled={draft.trim().length === 0} type="submit">
          <SessionIcon name="send" />
        </button>
      </form>
    </aside>
  );
}
