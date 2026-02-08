/**
 * Calculate retry delay using exponential backoff strategy.
 * @param retryDelay - Base delay in milliseconds
 * @param retryCount - Current retry attempt count
 * @param status - HTTP status code of the failed request
 * @returns Delay in milliseconds before the next retry attempt
 */
export function calculateRetryDelay(
  retryDelay: number,
  retryCount: number,
  status: number,
): number {
  // For 429 Too Many Requests, use exponential backoff to help mitigate rate limits
  if (status === 429) {
    return retryDelay * Math.pow(2, retryCount);
  }
  // For other retryable errors, use a linear backoff strategy
  return retryDelay * (retryCount + 1);
}

/**
 * Delay execution for a specified number of milliseconds.
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if the HTTP method is safe to retry.
 * Non-idempotent methods (POST, PATCH) are not retried by default
 * to prevent duplicate side effects.
 * @param method - HTTP method string (e.g. 'GET', 'POST')
 * @param retryableHttpMethods - List of HTTP methods allowed to be retried
 * @returns true if the method is allowed to be retried
 */
export function isMethodRetryable(
  method: string | undefined,
  retryableHttpMethods: readonly string[],
): boolean {
  if (!method) return false;
  return retryableHttpMethods.includes(method.toUpperCase());
}
