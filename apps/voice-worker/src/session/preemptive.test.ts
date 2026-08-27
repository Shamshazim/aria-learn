import { describe, expect, it } from 'vitest';

import { PREEMPTIVE_GENERATION } from '@/session/agent-session';

describe('preemptive generation', () => {
  it('starts the harness early and speaks nothing until the gate has passed it', () => {
    expect(PREEMPTIVE_GENERATION).toEqual({ enabled: true, preemptiveTts: false });
  });
});
