import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, sessionIdSchema, type TutorInputEvent } from '@aria/shared';
import type { TutorHarness } from '@aria/tutor';

import type { ApiModelContext } from '@/services/content/turn-content.service';
import { handleEngagementSignal } from '@/services/tutor/engagement-turn';
import { createVocalCueConsent, VOCAL_CUES_CATEGORY } from '@/services/tutor/vocal-cue-consent';
import type { VoiceConsent } from '@/types/voice';

const SESSION_ID = sessionIdSchema.parse('00000000-0000-4000-8000-000000000901');

const CUE = {
  id: 'cue-1',
  at: '2026-11-10T20:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
  sessionId: SESSION_ID,
  kind: 'ENGAGEMENT_SIGNAL',
  signal: 'vocal_cue',
  suggests: 'tired',
} satisfies Extract<TutorInputEvent, { kind: 'ENGAGEMENT_SIGNAL' }>;

function consent(categories: readonly string[]): VoiceConsent {
  return {
    id: 'consent-1',
    parentId: 'parent-1',
    studentId: 'student-1',
    status: 'granted',
    processorCategories: categories,
    retainReadingAudio: false,
    verificationReference: 'ref',
    grantedBy: null,
    processorMapVersion: null,
    verifiedAt: new Date(),
    withdrawnAt: null,
  };
}

/** A fake consent repository: what the database would say, without the database. */
function consents(granted: VoiceConsent | null) {
  return { findGranted: vi.fn(() => Promise.resolve(granted)) };
}

describe('vocal cues and consent (P3-05)', () => {
  it('needs a granted consent that names vocal cues', async () => {
    expect(await createVocalCueConsent(consents(null))('student-1')).toBe(false);
    expect(
      await createVocalCueConsent(consents(consent(['media', 'stt', 'tts'])))('student-1'),
    ).toBe(false);
    expect(
      await createVocalCueConsent(consents(consent(['media', 'stt', 'tts', VOCAL_CUES_CATEGORY])))(
        'student-1',
      ),
    ).toBe(true);
  });

  it('drops a cue without consent before the tutor sees it, and logs the drop', async () => {
    const speculate = vi.fn<TutorHarness<ApiModelContext>['speculate']>();
    const harness: TutorHarness<ApiModelContext> = {
      speculate,
      finalize: vi.fn<TutorHarness<ApiModelContext>['finalize']>(),
      handle: vi.fn<TutorHarness<ApiModelContext>['handle']>(),
    };
    const logger = { info: vi.fn() };
    const moves = await handleEngagementSignal({
      event: CUE,
      studentId: 'student-1',
      harness,
      commit: vi.fn(),
      vocalCuesAllowed: createVocalCueConsent(consents(consent(['media', 'stt', 'tts']))),
      logger,
    });
    expect(moves).toEqual([]);
    expect(speculate).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'engagement.vocal_cue_dropped' }),
      expect.any(String),
    );
  });
});
