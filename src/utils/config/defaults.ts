export const DEFAULT_TIMEOUT = 30000; // 30 seconds (in milliseconds)

export const DEFAULT_TOKEN_REFRESH_BUFFER = 300; // 5 minutes (in seconds)

/**
 * All default config values
 */
export const DEFAULT_CONFIG = {
  timeout: DEFAULT_TIMEOUT,
  tokenRefreshBuffer: DEFAULT_TOKEN_REFRESH_BUFFER,
} as const;

/**
 * HTTP methods considered idempotent and safe to retry automatically.
 * Non-idempotent methods (POST, PATCH) are excluded by default to prevent
 * duplicate side effects (e.g., duplicate creates/charges/shipments).
 */
export const IDEMPOTENT_HTTP_METHODS = [
  'GET',
  'HEAD',
  'PUT',
  'DELETE',
  'OPTIONS',
] as const;

/**
 * Retry configuration
 */
export const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second (in milliseconds)
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableHttpMethods: IDEMPOTENT_HTTP_METHODS,
} as const;
