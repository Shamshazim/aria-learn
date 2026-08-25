import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

import { SECRET_PICTURE_LENGTH, type PictureSecret } from '@aria/shared';

/**
 * The child's four-picture secret, hashed.
 *
 * Sixteen pictures and four taps is 65,536 combinations — small, and it has to be, because a
 * five-year-old has to remember it without reading. That makes this the one credential in the
 * system that a stolen database could brute-force offline, so it gets what a low-entropy
 * secret needs: a per-child random salt, and scrypt tuned so a full sweep of the keyspace
 * costs hours rather than milliseconds.
 *
 * The online attack is bounded elsewhere — by the attempt throttle on the student row and by
 * the device grant an attempt has to arrive through. Neither replaces this one.
 */
/**
 * `promisify` resolves to scrypt's three-argument overload, which silently drops the options
 * object carrying the cost parameters — a hash that looked right and cost nothing. Wrapping it
 * by hand keeps the four-argument form, and the arguments visible.
 */
type ScryptOptions = { N: number; r: number; p: number; maxmem: number };

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/**
 * OWASP's current minimum for scrypt (N=2^17, r=8, p=1). At four pictures that is roughly
 * 65,536 × ~90ms of work for an exhaustive offline sweep of a single child's secret.
 */
const COST = { N: 1 << 17, r: 8, p: 1, keyLength: 32, saltBytes: 16 } as const;

const ALGORITHM = 'scrypt';

/** `scrypt$N$r$p$salt$hash`, so the cost parameters travel with the hash and can be raised. */
function encode(salt: Buffer, derived: Buffer): string {
  return [
    ALGORITHM,
    COST.N,
    COST.r,
    COST.p,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

type Decoded = { N: number; r: number; p: number; salt: Buffer; hash: Buffer };

function decode(stored: string): Decoded | null {
  const parts = stored.split('$');
  const [algorithm, n, r, p, salt, hash] = parts;
  if (parts.length !== 6 || algorithm !== ALGORITHM || !n || !r || !p || !salt || !hash)
    return null;

  const parsed = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Number.isInteger(parsed.N) || !Number.isInteger(parsed.r) || !Number.isInteger(parsed.p)) {
    return null;
  }

  return {
    ...parsed,
    salt: Buffer.from(salt, 'base64url'),
    hash: Buffer.from(hash, 'base64url'),
  };
}

/**
 * The sequence, canonicalised before hashing. Order matters — it is half the secret — so the
 * separator is a character no picture key contains, and the pictures are not sorted.
 */
function canonical(secret: PictureSecret): string {
  return secret.join('|');
}

export async function hashPictureSecret(secret: PictureSecret): Promise<string> {
  if (secret.length !== SECRET_PICTURE_LENGTH) {
    throw new RangeError(`a picture secret is exactly ${String(SECRET_PICTURE_LENGTH)} pictures`);
  }

  const salt = randomBytes(COST.saltBytes);
  const derived = await derive(canonical(secret), salt, COST);
  return encode(salt, derived);
}

/**
 * Constant-time by construction: scrypt is run against the stored parameters whatever the
 * outcome, so a wrong secret costs the same as a right one and reveals nothing by timing.
 * A stored value that will not decode is a corrupt row, and a corrupt row is not a match.
 */
export async function pictureSecretMatches(
  secret: PictureSecret,
  stored: string,
): Promise<boolean> {
  const decoded = decode(stored);
  if (decoded === null) return false;

  const derived = await derive(canonical(secret), decoded.salt, {
    ...decoded,
    keyLength: decoded.hash.length,
  });

  return derived.length === decoded.hash.length && timingSafeEqual(derived, decoded.hash);
}

async function derive(
  value: string,
  salt: Buffer,
  cost: { N: number; r: number; p: number; keyLength: number },
): Promise<Buffer> {
  // `maxmem` has to be raised with N or scrypt refuses; the formula is Node's own minimum.
  const maxmem = 256 * cost.N * cost.r;
  return scryptAsync(value, salt, cost.keyLength, { N: cost.N, r: cost.r, p: cost.p, maxmem });
}
