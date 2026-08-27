import type { ChildPicture } from '@aria/shared';

/**
 * What each picture looks like, and what it is called out loud (P2H-12).
 *
 * Data, not logic. The label is what a screen reader says and what a grown-up reads over a
 * child's shoulder — "the fox", not "avatar 1" — because a picture password is only usable if
 * both of them can talk about it.
 */
export const CHILD_PICTURE_ART: Readonly<
  Record<ChildPicture, Readonly<{ emoji: string; label: string }>>
> = {
  fox: { emoji: '🦊', label: 'Fox' },
  owl: { emoji: '🦉', label: 'Owl' },
  whale: { emoji: '🐳', label: 'Whale' },
  rocket: { emoji: '🚀', label: 'Rocket' },
  apple: { emoji: '🍎', label: 'Apple' },
  star: { emoji: '⭐', label: 'Star' },
};
