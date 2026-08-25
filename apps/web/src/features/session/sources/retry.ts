import { ApiError } from '@/api/errors';

export function isRetryableRead(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'NETWORK_ERROR' || error.code === 'REQUEST_TIMEOUT')
  );
}

export async function retryRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (!isRetryableRead(error)) throw error;
    return read();
  }
}
