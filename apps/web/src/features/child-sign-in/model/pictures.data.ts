import { AVATAR_KEYS, SECRET_PICTURE_KEYS } from '@aria/shared';
import type { AvatarKey, SecretPictureKey } from '@aria/shared';

/**
 * What each picture key looks like, and what a screen reader calls it.
 *
 * The keys are the protocol and live in `@aria/shared`; this file is only their appearance, so
 * a picture can be redrawn without touching a stored secret. Data, not logic (§2).
 *
 * Every tile carries a `label` because a child using a screen reader has to be able to sign in
 * too — the interface must not require *sight* any more than it requires reading.
 */
export type PictureFace = Readonly<{ emoji: string; label: string }>;

export const AVATAR_FACES: Readonly<Record<AvatarKey, PictureFace>> = {
  fox: { emoji: '🦊', label: 'Fox' },
  owl: { emoji: '🦉', label: 'Owl' },
  bear: { emoji: '🐻', label: 'Bear' },
  rabbit: { emoji: '🐰', label: 'Rabbit' },
  turtle: { emoji: '🐢', label: 'Turtle' },
  whale: { emoji: '🐳', label: 'Whale' },
  penguin: { emoji: '🐧', label: 'Penguin' },
  hedgehog: { emoji: '🦔', label: 'Hedgehog' },
  panda: { emoji: '🐼', label: 'Panda' },
  koala: { emoji: '🐨', label: 'Koala' },
  otter: { emoji: '🦦', label: 'Otter' },
  deer: { emoji: '🦌', label: 'Deer' },
};

export const SECRET_FACES: Readonly<Record<SecretPictureKey, PictureFace>> = {
  apple: { emoji: '🍎', label: 'Apple' },
  banana: { emoji: '🍌', label: 'Banana' },
  star: { emoji: '⭐', label: 'Star' },
  moon: { emoji: '🌙', label: 'Moon' },
  sun: { emoji: '☀️', label: 'Sun' },
  cloud: { emoji: '☁️', label: 'Cloud' },
  tree: { emoji: '🌳', label: 'Tree' },
  flower: { emoji: '🌻', label: 'Flower' },
  boat: { emoji: '⛵', label: 'Boat' },
  car: { emoji: '🚗', label: 'Car' },
  rocket: { emoji: '🚀', label: 'Rocket' },
  kite: { emoji: '🪁', label: 'Kite' },
  drum: { emoji: '🥁', label: 'Drum' },
  bell: { emoji: '🔔', label: 'Bell' },
  ball: { emoji: '⚽', label: 'Ball' },
  hat: { emoji: '🎩', label: 'Hat' },
};

/** A fallback, so an unknown key renders as a tile rather than as nothing. */
export const UNKNOWN_FACE: PictureFace = { emoji: '❓', label: 'Picture' };

export const AVATAR_ORDER: readonly AvatarKey[] = AVATAR_KEYS;
export const SECRET_ORDER: readonly SecretPictureKey[] = SECRET_PICTURE_KEYS;
