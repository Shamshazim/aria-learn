/** P3-03: the parent-readable bar, as a lint finding the regeneration can act on. */
export function readability(body: string, wordCap: number): readonly string[] {
  const words = body
    .trim()
    .split(/\s+/u)
    .filter((word) => word !== '').length;
  return words > wordCap ? [`is ${String(words)} words; the limit is ${String(wordCap)}`] : [];
}
