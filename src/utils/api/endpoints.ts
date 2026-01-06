/**
 * InPost API endpoints
 */

const AUTH_ENDPOINTS = {
  token: '/auth/token',
} as const;

export const ENDPOINTS = {
  auth: AUTH_ENDPOINTS,
} as const;
