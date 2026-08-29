import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SpeakButton } from '@/features/session/components/SpeakButton';
import { VOICE_REASON_COPY } from '@/features/session/copy/voice.copy';

describe('SpeakButton', () => {
  it('talks to Aria when voice is ready, and says nothing else', async () => {
    const onSpeech = vi.fn();
    render(<SpeakButton band="middle" onSpeech={onSpeech} voice="ready" />);

    await userEvent.click(screen.getByRole('button', { name: /Talk to Aria/u }));

    expect(onSpeech).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each(['connecting', 'needs-consent', 'unavailable', 'off'] as const)(
    'is disabled with the reason beside it when voice is %s',
    (voice) => {
      render(<SpeakButton band="early" onSpeech={() => undefined} voice={voice} />);

      const button = screen.getByRole('button', { name: /Talk to Aria/u });
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(VOICE_REASON_COPY[voice].early);
      expect(screen.getByRole('status')).toHaveTextContent(VOICE_REASON_COPY[voice].early);
    },
  );
});
