import { describe, expect, it } from 'vitest';

import { spokenForm } from '@aria/voice';

import { renderProsody, REVIEWED_VENDORS, synthesisOptions } from '@/voice/vendor';

const MARKED = spokenForm('Count the *shapes*… ready?');

describe('vendor prosody', () => {
  it('renders emphasis and a beat as markup for an engine that reads markup', () => {
    expect(renderProsody(MARKED, 'elevenlabs/eleven_flash_v2')).toBe(
      'Count the <emphasis level="moderate">shapes</emphasis> <break time="300ms"/> ready?',
    );
  });

  it('strips every marker for an engine that reads none, and never speaks one', () => {
    const spoken = renderProsody(MARKED, 'fishaudio/s2.1-pro');

    expect(spoken).toBe('Count the shapes ready?');
    expect(spoken).not.toMatch(/\[\[|emphasis|pause/u);
  });

  it('treats an unknown engine as one that renders nothing', () => {
    expect(renderProsody(MARKED, 'somebody/new-model')).toBe('Count the shapes ready?');
    expect(synthesisOptions('somebody/new-model', 0.92)).toEqual({});
  });

  /** Every row of the reviewed table, not a sample of it: a marker must never be spoken. */
  it.each(Object.keys(REVIEWED_VENDORS))('never leaves a marker readable for %s', (vendor) => {
    const spoken = renderProsody(MARKED, `${vendor}/some-model`);

    expect(spoken).not.toMatch(/\[\[|\]\]/u);
    expect(spoken).toContain('shapes');
    expect(spoken).toContain('ready?');
  });

  it('asks for the band rate in the provider its own word for it', () => {
    expect(synthesisOptions('fishaudio/s2.1-pro', 0.92)).toEqual({ speed: 0.92 });
    expect(synthesisOptions('inworld/inworld-tts-2', 0.92)).toEqual({ speaking_rate: 0.92 });
  });

  it('says nothing about rate when the band speaks at the natural pace', () => {
    expect(synthesisOptions('fishaudio/s2.1-pro', 1)).toEqual({});
  });
});
