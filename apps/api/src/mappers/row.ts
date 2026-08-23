import { AppError, ERROR_CODES } from '@/errors';

/**
 * A row that cannot be mapped is our bug, not the caller's: something wrote a value the
 * domain type does not admit, or a column changed shape under us. It is a 500, and the log
 * says which column on which table — never the value, which is the part we may not repeat.
 */
export function unmappableRow(table: string, column: string, id: unknown): AppError {
  const reference = typeof id === 'string' ? ` id=${id}` : '';
  return new AppError(ERROR_CODES.INTERNAL, 500, 'Something went wrong.', {
    logMessage: `${table}.${column} holds a value outside its domain type${reference}`,
  });
}
