import { isUnsafeChildFacingText } from '@/safety/crisis/detect';

/**
 * The safety checker the quality gate is built with.
 *
 * Shared by the request path and the pre-warm script (P2H-10) so a batch of items written
 * overnight is held to exactly the bar an item generated mid-session is. A second, laxer copy
 * of this rule in a script is how a bank quietly stops meaning anything.
 */
export function outputSafety(text: string): Readonly<{
  safe: boolean;
  categories: readonly string[];
}> {
  const unsafe = isUnsafeChildFacingText(text);
  return { safe: !unsafe, categories: unsafe ? ['blocked-output'] : [] };
}
