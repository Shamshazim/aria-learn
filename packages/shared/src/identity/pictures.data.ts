/**
 * The picture vocabulary a child signs in with.
 *
 * Data, not logic, so it lives beside the module that gives it meaning rather than inside it
 * (CODE-STANDARDS §2). Both sides need the same list: the web app renders these keys as
 * images, the API validates against them, and a key that only one side knows is a child who
 * cannot sign in.
 *
 * The keys are stable identifiers, never file names and never display text — a picture can be
 * redrawn or relabelled without invalidating a child's secret.
 */

/** Pictures a parent may choose as the child's own recognisable tile on the picker. */
export const AVATAR_KEYS = [
  'fox',
  'owl',
  'bear',
  'rabbit',
  'turtle',
  'whale',
  'penguin',
  'hedgehog',
  'panda',
  'koala',
  'otter',
  'deer',
] as const;

/**
 * Pictures the four-picture secret is drawn from.
 *
 * Sixteen tiles, four taps, repeats allowed: 65,536 combinations. That is small — it has to
 * be, for a five-year-old — so the size of this list is not the control. The controls are the
 * attempt throttle in `student`, the device grant the attempt has to arrive through, and the
 * fact that nothing here is a password reused anywhere else.
 */
export const SECRET_PICTURE_KEYS = [
  'apple',
  'banana',
  'star',
  'moon',
  'sun',
  'cloud',
  'tree',
  'flower',
  'boat',
  'car',
  'rocket',
  'kite',
  'drum',
  'bell',
  'ball',
  'hat',
] as const;

/** How many pictures a child taps. Four is the shortest sequence a child reliably recalls. */
export const SECRET_PICTURE_LENGTH = 4;
