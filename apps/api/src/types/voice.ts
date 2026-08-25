import type { TutorMove } from '@aria/shared';

export type VoiceConsent = Readonly<{
  id: string;
  parentId: string;
  studentId: string;
  status: 'granted' | 'withdrawn';
  processorCategories: readonly string[];
  retainReadingAudio: boolean;
  verificationReference: string;
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
