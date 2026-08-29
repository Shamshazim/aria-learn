import type { Queryable } from '@/db/types';
import type { VoiceConsentRepository } from '@/repositories/voice-consent.repository';
import type { VoiceConsent } from '@/types/voice';

type ConsentLookup = Pick<VoiceConsentRepository, 'findGranted'> &
  Readonly<{ withDb(db: Queryable): ConsentLookup }>;

/**
 * The demo student can speak without a parent (development only).
 *
 * Voice needs verified parental consent, and the demo student has no parent: a laptop that
 * enabled `ALLOW_DEMO_STUDENT` to skip sign-in was still one `403` away from a working
 * microphone. The switch already refuses to take effect outside `NODE_ENV=development`, so
 * this consent can only ever be minted where there is no real child behind the row.
 *
 * Every other student goes to the real repository, unchanged.
 */
export function withDemoVoiceConsent(
  consent: ConsentLookup,
  demo: Readonly<{ studentId: string | undefined; processors: readonly string[] }>,
): ConsentLookup {
  if (demo.studentId === undefined) return consent;
  const demoStudentId = demo.studentId;
  return {
    withDb: (db) => withDemoVoiceConsent(consent.withDb(db), demo),
    findGranted: (studentId) =>
      studentId === demoStudentId
        ? Promise.resolve(demoConsent(demoStudentId, demo.processors))
        : consent.findGranted(studentId),
  };
}

function demoConsent(studentId: string, processors: readonly string[]): VoiceConsent {
  return {
    id: `demo-consent-${studentId}`,
    parentId: 'demo-parent',
    studentId,
    status: 'granted',
    processorCategories: [...processors],
    retainReadingAudio: false,
    verificationReference: 'demo-student',
    grantedBy: null,
    processorMapVersion: null,
    verifiedAt: new Date(0),
    withdrawnAt: null,
  };
}
