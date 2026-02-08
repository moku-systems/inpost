// tests/unit/client/helpers.ts
import { InPostClient } from '../../../src/client/InPostClient';
import { AuthManager } from '../../../src/auth/AuthManager';
import { InPostAPIError } from '../../../src/utils/errors';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { AuthScope } from '../../../src/types/auth';

// NOTE: Each test file must declare its own jest.mock() calls (they are hoisted
// per-file by Jest). The typed aliases below are safe to export because they
// only cast the already-mocked modules.

export const mockedAxios = axios as jest.Mocked<typeof axios>;
export const MockedAuthManager = AuthManager as jest.MockedClass<
  typeof AuthManager
>;

// ── Shared constants ──────────────────────────────────────────────────

export const DEFAULT_CLIENT_CONFIG = {
  clientId: 'test-client-id',
  clientSecret: 'test-secret',
  environment: 'sandbox' as const,
  scope: ['api:points:read'] as AuthScope[],
};

export const BASE_REQUEST_CONFIG: Partial<InternalAxiosRequestConfig> = {
  method: 'GET',
  url: '/test',
  headers: {} as any,
};

export const RETRIED_REQUEST_CONFIG: Partial<InternalAxiosRequestConfig> = {
  ...BASE_REQUEST_CONFIG,
  headers: { 'x-retry-count': '3' } as any,
};

// ── Helpers ───────────────────────────────────────────────────────────

/** Build a minimal AxiosError-like object used by the response interceptor. */
export function createAxiosError(
  overrides: {
    status?: number;
    data?: Record<string, unknown>;
    headers?: Record<string, string>;
    statusText?: string;
    config?: Partial<InternalAxiosRequestConfig>;
    hasResponse?: boolean;
    hasRequest?: boolean;
    message?: string;
  } = {},
): Partial<AxiosError> {
  const {
    status,
    data = {},
    headers = {},
    statusText = '',
    config = RETRIED_REQUEST_CONFIG,
    hasResponse = true,
    hasRequest = true,
    message,
  } = overrides;

  const error: Partial<AxiosError> = { isAxiosError: true };

  if (hasResponse && status !== undefined) {
    error.response = {
      status,
      data,
      headers,
      statusText,
      config: config as any,
    };
  } else if (hasRequest) {
    error.request = {};
  }

  if (config) error.config = config as any;
  if (message) error.message = message;

  return error;
}

/** Assert that the interceptor rejects with an InPostAPIError matching expectations. */
export async function expectAPIError(
  interceptor: (err: unknown) => Promise<unknown>,
  axiosError: Partial<AxiosError>,
  expected: {
    statusCode: number;
    message?: string | RegExp;
    requestId?: string;
    property?: keyof InPostAPIError;
    propertyValue?: unknown;
  },
): Promise<void> {
  await expect(interceptor(axiosError)).rejects.toThrow(InPostAPIError);

  try {
    await interceptor(axiosError);
  } catch (error) {
    const apiError = error as InPostAPIError;
    expect(apiError).toBeInstanceOf(InPostAPIError);
    expect(apiError.statusCode).toBe(expected.statusCode);

    if (expected.message instanceof RegExp) {
      expect(apiError.message).toMatch(expected.message);
    } else if (expected.message) {
      expect(apiError.message).toBe(expected.message);
    }

    if (expected.requestId) {
      expect(apiError.requestId).toBe(expected.requestId);
    }

    if (expected.property) {
      expect(apiError[expected.property]).toBe(expected.propertyValue ?? true);
    }
  }
}

// ── Test environment setup ────────────────────────────────────────────

export interface TestContext {
  client: InPostClient;
  mockAxiosInstance: any;
  mockAuthManager: jest.Mocked<AuthManager>;
  responseInterceptorError: (err: unknown) => Promise<unknown>;
}

export function setupTestContext(): TestContext {
  const ctx = {} as TestContext;

  beforeEach(() => {
    jest.clearAllMocks();

    ctx.mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    mockedAxios.create.mockReturnValue(ctx.mockAxiosInstance);

    ctx.mockAuthManager = new MockedAuthManager(
      DEFAULT_CLIENT_CONFIG,
    ) as jest.Mocked<AuthManager>;

    ctx.mockAuthManager.getAccessToken.mockResolvedValue('mock-access-token');
    MockedAuthManager.mockImplementation(() => ctx.mockAuthManager);

    ctx.client = new InPostClient(DEFAULT_CLIENT_CONFIG);

    // Capture response interceptor error handler
    ctx.responseInterceptorError =
      ctx.mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
  });

  return ctx;
}
