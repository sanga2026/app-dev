/**
 * Extracts a human-readable error message from an API error response.
 * Handles:
 *  - NestJS class-validator arrays: { message: ['field must be...', ...] }
 *  - Single message strings: { message: 'Something went wrong' }
 *  - Empty or undefined responses
 */
export function extractErrorMessage(err: any, fallback = 'An unexpected error occurred. Please try again.'): string {
  const msg = err?.error?.message;
  if (Array.isArray(msg) && msg.length > 0) return msg[0];
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  const statusText = err?.statusText;
  if (statusText && statusText !== 'Unknown Error') return statusText;
  return fallback;
}
