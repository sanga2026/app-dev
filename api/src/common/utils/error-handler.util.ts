/**
 * Safely extracts a message from an unknown error type.
 * This guarantees we always get a readable string for our logs
 * without breaking TypeScript's strict rules.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as Record<string, unknown>).message);
  }

  if (typeof error === 'string') {
    return error;
  }

  return String(error);
}

export function hasErrorCode(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}