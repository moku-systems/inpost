import { AccessToken, AuthScope } from './auth';

export type InPostConfig = {
  clientSecret: string; // Client secret for auth
  clientId: string; // Client ID for auth
  scope: AuthScope[]; // Array of auth scopes
  environment: 'sandbox' | 'production'; // API environment
  timeout?: number; // Request timeout in milliseconds (default: 30000)
  tokenRefreshBuffer?: number; // Refresh N seconds before expiry (default: 300)
  onTokenRefresh?: (token: AccessToken) => void; // Callback on token refresh
  maxRetries?: number; // Maximum number of retries for failed requests (default: 3)
  retryDelay?: number; // Delay between retries in milliseconds (default: 1000)
  retryableStatusCodes?: readonly number[]; // HTTP status codes that should trigger a retry
  retryableHttpMethods?: readonly string[]; // HTTP methods safe to retry (default: GET, HEAD, PUT, DELETE, OPTIONS)
};

export type PaginationParams = {
  page?: number;
  perPage?: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  perPage: number;
  totalPages: number;
  totalCount: number;
};
