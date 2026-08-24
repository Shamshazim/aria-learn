import type { TutorInputEvent, TutorMove } from '@aria/shared';

export type TutorSource = Readonly<{
  send(event: TutorInputEvent, signal?: AbortSignal): AsyncIterable<TutorMove>;
  close(): void;
}>;
