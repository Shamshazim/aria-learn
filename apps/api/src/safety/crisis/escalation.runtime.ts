import { ServiceUnavailableError } from '@/errors';
import type { EscalationPort } from '@/safety/crisis/escalate';

export function createWebhookEscalationPort(
  input: Readonly<{
    url: string | undefined;
    token: string | undefined;
    fetcher: typeof globalThis.fetch;
  }>,
): EscalationPort {
  return {
    notify: async (event) => {
      if (input.url === undefined || input.token === undefined) {
        throw new ServiceUnavailableError('safeguarding escalation is not configured');
      }
      const response = await input.fetcher(input.url, {
        method: 'POST',
        headers: { authorization: `Bearer ${input.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(event),
      });
      if (!response.ok) throw new ServiceUnavailableError('safeguarding escalation failed');
    },
  };
}
