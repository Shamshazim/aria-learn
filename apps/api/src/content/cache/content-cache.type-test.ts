import type { ContentCacheService } from '@/content';

type StorePass = Parameters<ContentCacheService['store']>[1];

// @ts-expect-error A boolean-shaped lookalike is not proof that the quality gate passed.
const INVALID_PASS: StorePass = { verdict: 'pass' };
void INVALID_PASS;
