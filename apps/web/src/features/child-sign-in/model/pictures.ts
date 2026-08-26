import { AVATAR_FACES, SECRET_FACES, UNKNOWN_FACE } from './pictures.data';

import type { PictureFace } from './pictures.data';

export type { PictureFace };
export { AVATAR_ORDER, SECRET_ORDER } from './pictures.data';

/**
 * Looking a face up without letting an unknown key become an empty tile.
 *
 * A key the server knows and this build does not is a deployment skew, not a reason to render
 * a child a blank square they cannot tap.
 */
export function avatarFace(key: string | null): PictureFace {
  if (key === null) return UNKNOWN_FACE;
  return lookup(AVATAR_FACES, key);
}

export function secretFace(key: string): PictureFace {
  return lookup(SECRET_FACES, key);
}

function lookup(faces: Readonly<Record<string, PictureFace>>, key: string): PictureFace {
  return faces[key] ?? UNKNOWN_FACE;
}
