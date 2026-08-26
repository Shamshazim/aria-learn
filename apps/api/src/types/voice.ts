import type { TutorMove } from '@aria/shared';

export type VoiceConsent = Readonly<{
  id: string;
  parentId: string;
  studentId: string;
  status: 'granted' | 'withdrawn';
  processorCategories: readonly string[];
  retainReadingAudio: boolean;
  verificationReference: string;
  /**
   * P2H-12: the parent who actually granted it, and the wording of the processor map they
   * were shown. `parentId` says whose child this is; these two say what happened and when.
   */
  grantedBy: string | null;
  processorMapVersion: string | null;
  verifiedAt: Date;
  withdrawnAt: Date | null;
}>;

export type RealtimeCredentials = Readonly<{
  url: string;
  token: string;
  room: string;
  region: string;
  expiresAt: string;
  processors: readonly string[];
  connectionEpoch: number;
}>;

export type OutboxMove = Readonly<{
  serverSeq: number;
  move: TutorMove;
}>;
