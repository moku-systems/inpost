/**
 * InPost API hosts configuration
 *
 * @see https://developers.inpost-group.com/previous
 */

export const INPOST_HOSTS = {
  sandbox: 'https://sandbox-api.inpost-group.com',
  production: 'https://api.inpost-group.com',
} as const;

export type InPostEnvironment = keyof typeof INPOST_HOSTS;

/**
 * Get host from environment or use default
 * Allows override via environment variables for testing
 */
export function getHost(environment: InPostEnvironment): string {
  if (environment === 'sandbox' && process.env.INPOST_HOST) {
    return process.env.INPOST_HOST;
  }
  if (environment === 'production' && process.env.INPOST_HOST) {
    return process.env.INPOST_HOST;
  }

  return INPOST_HOSTS[environment];
}

/**
 * Build full URL for InPost API
 *
 * @example
 * ```typescript
 * buildUrl('sandbox', '/auth/token')
 * // Returns: 'https://sandbox-api.inpost-group.com/auth/token'
 * ```
 */
export function buildUrl(
  environment: InPostEnvironment,
  endpoint: string
): string {
  const host = getHost(environment);
  return `${host}${endpoint}`;
}
