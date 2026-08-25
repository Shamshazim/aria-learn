import { z } from 'zod';

const result = z.object({ VITE_API_BASE_URL: z.string().optional() }).safeParse(import.meta.env);

export const webConfig: Readonly<{ apiBaseUrl: string }> = {
  apiBaseUrl: result.success ? (result.data.VITE_API_BASE_URL ?? '') : '',
};
