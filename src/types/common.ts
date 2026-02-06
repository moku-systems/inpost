import { AccessToken, AuthScope } from './auth';

export type InPostConfig = {
  clientSecret: string; // Client secret for auth
  clientId: string; // Client ID for auth
  scope: AuthScope[];
  environment: 'sandbox' | 'production';
  timeout?: number;
  tokenRefreshBuffer?: number; // Refresh N seconds before expiry (default: 300)
  onTokenRefresh?: (token: AccessToken) => void; // Callback on token refresh
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
