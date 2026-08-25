import type { Band, TutorMove } from '@aria/shared';

export type WordTiming = Readonly<{
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
}>;

export type Transcript = Readonly<{
  text: string;
  confidence: number;
  words: readonly WordTiming[];
  speaker: 'expected' | 'uncertain';
}>;

export type SttListenOptions = Readonly<{
  band: Band;
  vocabularyHint?: readonly string[];
}>;

export type ConversationalStt = Readonly<{
  listen(audio: AsyncIterable<Uint8Array>, options: SttListenOptions): AsyncIterable<Transcript>;
}>;

/** Reading input intentionally has no passage or vocabulary hint. */
export type ReadingStt = Readonly<{
  listen(
    audio: AsyncIterable<Uint8Array>,
    options: Readonly<{ band: Band }>,
  ): AsyncIterable<Transcript>;
}>;

export type TurnDetector = Readonly<{
  isComplete(input: Readonly<{ transcript: string; band: Band }>): Promise<boolean>;
}>;

export type TextToSpeech = Readonly<{
  speak(
    input: Readonly<{ text: string; generationId: string }>,
    signal: AbortSignal,
  ): AsyncIterable<Uint8Array>;
}>;

export type SpeechAsset = Readonly<{
  id: string;
  text: string;
  band: Band;
  voice: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
}>;

export type SpeechAssetStore = Readonly<{
  findApproved(hash: string): Promise<SpeechAsset | null>;
}>;

export type BridgeIntent = 'answer' | 'question' | 'stuck' | 'request' | 'leaving' | 'unclear';

export type IntentClassifier = Readonly<{
  classify(
    input: Readonly<{ expects: TutorMove['expects']; transcript: string; band: Band }>,
  ): Promise<Readonly<{ intent: BridgeIntent; confidence: number }>>;
}>;
