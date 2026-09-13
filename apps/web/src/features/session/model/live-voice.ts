/**
 * What the screen shows of the voice while Aria talks.
 *
 * Where a realtime model is Aria's voice, the words she says are her own and differ from the
 * move's stored line. Showing the stored line while she says something else is what made the
 * screen look out of step; the layouts show this instead, and keep the question exact.
 */
export type LiveVoice = Readonly<{
  /** True where a realtime model is the voice, so its transcript replaces a move's line. */
  talks: boolean;
  /** Everything Aria has said in her current turn. */
  transcript: string;
  /** What she last heard the child say. */
  heard: string;
  speaking: boolean;
}>;

export const NO_LIVE_VOICE: LiveVoice = {
  talks: false,
  transcript: '',
  heard: '',
  speaking: false,
};
