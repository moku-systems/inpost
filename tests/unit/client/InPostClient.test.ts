// tests/unit/client/InPostClient.test.ts
import { InPostClient } from '../../../src/client/InPostClient';
import { AuthManager } from '../../../src/auth/AuthManager';
import { InPostAPIError } from '../../../src/utils/errors';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { INPOST_HOSTS } from '../../../src/utils/api';
import type { AuthScope } from '../../../src/types/auth';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock AuthManager
jest.mock('../../../src/auth/AuthManager');
const MockedAuthManager = AuthManager as jest.MockedClass<typeof AuthManager>;

// ── Shared constants ──────────────────────────────────────────────────

const DEFAULT_CLIENT_CONFIG = {
  clientId: 'test-client-id',
  clientSecret: 'test-secret',
  environment: 'sandbox' as const,
  scope: ['api:points:read'] as AuthScope[],
};

const BASE_REQUEST_CONFIG: Partial<InternalAxiosRequestConfig> = {
  method: 'GET',
  url: '/test',
  headers: {} as any,
};

const RETRIED_REQUEST_CONFIG: Partial<InternalAxiosRequestConfig> = {
  ...BASE_REQUEST_CONFIG,
  headers: { 'x-retry-count': '1' } as any,
};

// ── Helpers ───────────────────────────────────────────────────────────

/** Build a minimal AxiosError-like object used by the response interceptor. */
function createAxiosError(
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
async function expectAPIError(
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

// ── Tests ─────────────────────────────────────────────────────────────

describe('InPostClient', () => {
  let client: InPostClient;
  let mockAxiosInstance: any;
  let mockAuthManager: jest.Mocked<AuthManager>;
  let responseInterceptorError: (err: unknown) => Promise<unknown>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      request: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    mockAuthManager = new MockedAuthManager(
      DEFAULT_CLIENT_CONFIG,
    ) as jest.Mocked<AuthManager>;

    mockAuthManager.getAccessToken.mockResolvedValue('mock-access-token');
    MockedAuthManager.mockImplementation(() => mockAuthManager);

    client = new InPostClient(DEFAULT_CLIENT_CONFIG);

    // Capture response interceptor error handler once for all suites
    responseInterceptorError =
      mockAxiosInstance.interceptors.response.use.mock.calls[0][1];
  });

  describe('constructor', () => {
    it('should create axios instance with correct baseURL (sandbox)', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: INPOST_HOSTS['sandbox'],
          timeout: 30000,
        }),
      );
    });

    it('should create axios instance with correct baseURL (production)', () => {
      jest.clearAllMocks();

      new InPostClient({ ...DEFAULT_CLIENT_CONFIG, environment: 'production' });

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: INPOST_HOSTS['production'],
        }),
      );
    });

    it('should use custom timeout if provided', () => {
      jest.clearAllMocks();

      new InPostClient({ ...DEFAULT_CLIENT_CONFIG, timeout: 60000 });

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({ timeout: 60000 }),
      );
    });

    it('should setup request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('HTTP methods', () => {
    describe('get', () => {
      it('should make GET request and return data', async () => {
        const mockData = { id: '123', name: 'Test' };
        mockAxiosInstance.get.mockResolvedValue({ data: mockData });

        const result = await client.get('/test-endpoint');

        expect(mockAxiosInstance.get).toHaveBeenCalledWith(
          '/test-endpoint',
          undefined,
        );
        expect(result).toEqual(mockData);
      });

      it('should pass config to axios', async () => {
        mockAxiosInstance.get.mockResolvedValue({ data: {} });

        const config = { params: { page: 1 } };
        await client.get('/test-endpoint', config);

        expect(mockAxiosInstance.get).toHaveBeenCalledWith(
          '/test-endpoint',
          config,
        );
      });
    });

    describe('post', () => {
      it('should make POST request and return data', async () => {
        const mockData = { id: '123' };
        const requestBody = { name: 'Test' };
        mockAxiosInstance.post.mockResolvedValue({ data: mockData });

        const result = await client.post('/test-endpoint', requestBody);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          '/test-endpoint',
          requestBody,
          undefined,
        );
        expect(result).toEqual(mockData);
      });
    });
  });

  describe('Request Interceptor', () => {
    it('should add Authorization header with access token', async () => {
      const requestInterceptor =
        mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

      const config = { headers: {}, method: 'GET', url: '/test' };
      const result = await requestInterceptor(config);

      expect(mockAuthManager.getAccessToken).toHaveBeenCalled();
      expect(result.headers.Authorization).toBe('Bearer mock-access-token');
    });

    it('should refresh token if expired', async () => {
      mockAuthManager.getAccessToken
        .mockResolvedValueOnce('old-token')
        .mockResolvedValueOnce('new-token');

      const requestInterceptor =
        mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

      const config1 = { headers: {}, method: 'GET', url: '/test1' };
      const config2 = { headers: {}, method: 'GET', url: '/test2' };

      await requestInterceptor(config1);
      await requestInterceptor(config2);

      expect(mockAuthManager.getAccessToken).toHaveBeenCalledTimes(2);
    });
  });

  describe('Response Interceptor - Error Handling', () => {
    it('should convert axios error to InPostAPIError (4xx)', async () => {
      const axiosError = createAxiosError({
        status: 400,
        data: {
          status: 400,
          title: 'Bad Request',
          message: 'Bad request',
          type: 'validation_error',
          errors: { 'field.firstName': ['First name is required'] },
        },
        headers: { 'x-request-id': 'req-123' },
        statusText: 'Bad Request',
      });

      await expectAPIError(responseInterceptorError, axiosError, {
        statusCode: 400,
        message: 'Invalid request to InPost API.',
        requestId: 'req-123',
      });
    });

    it('should convert axios error to InPostAPIError (5xx)', async () => {
      const axiosError = createAxiosError({
        status: 500,
        data: {
          status: 500,
          title: 'Internal Server Error',
          message: 'Internal server error',
          type: 'server_error',
        },
        statusText: 'Internal Server Error',
      });

      await expectAPIError(responseInterceptorError, axiosError, {
        statusCode: 500,
        message: 'InPost API server error.',
        property: 'isServerError',
      });
    });

    it('should handle 401 and retry with new token', async () => {
      mockAxiosInstance.request.mockResolvedValue({
        data: { success: true },
      });

      mockAuthManager.getAccessToken
        .mockResolvedValueOnce('old-token')
        .mockResolvedValueOnce('new-token');

      const axiosError = createAxiosError({
        status: 401,
        data: {
          status: 401,
          type: 'auth_error',
          message: 'Unauthorized access to InPost API.',
          title: 'Unauthorized',
        },
        statusText: 'Unauthorized',
        config: BASE_REQUEST_CONFIG,
      });

      const result = await responseInterceptorError(axiosError);

      expect(mockAuthManager.clearToken).toHaveBeenCalled();
      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          headers: expect.objectContaining({ 'x-retry-count': '1' }),
        }),
      );
      expect(result).toEqual({ data: { success: true } });
    });

    it('should not retry 401 more than once', async () => {
      const axiosError = createAxiosError({
        status: 401,
        data: {
          status: 401,
          type: 'auth_error',
          message: 'Unauthorized access to InPost API.',
          title: 'Unauthorized',
        },
        statusText: 'Unauthorized',
      });

      await expect(responseInterceptorError(axiosError)).rejects.toThrow(
        InPostAPIError,
      );
    });

    it('should handle network error (no response)', async () => {
      const axiosError = createAxiosError({
        hasResponse: false,
        hasRequest: true,
        message: 'Network Error',
      });

      await expectAPIError(responseInterceptorError, axiosError, {
        statusCode: 500,
        message: /No response from InPost API/,
      });
    });

    it('should handle unknown error', async () => {
      const axiosError: Partial<AxiosError> = {
        message: 'Something went wrong',
        isAxiosError: true,
      };

      await expectAPIError(responseInterceptorError, axiosError, {
        statusCode: 500,
        message: 'Something went wrong',
      });
    });
  });

  describe('Error classifications', () => {
    it.each([
      {
        status: 401,
        statusText: 'Unauthorized',
        message: 'Unauthorized access to InPost API.',
        property: 'isAuthError' as const,
      },
      {
        status: 403,
        statusText: 'Forbidden',
        message: 'Unauthorized access to InPost API.',
        property: 'isAuthError' as const,
      },
      {
        status: 404,
        statusText: 'Not Found',
        message: 'Requested resource not found in InPost API.',
        property: 'isNotFoundError' as const,
      },
      {
        status: 400,
        statusText: 'Bad Request',
        message: 'Invalid request to InPost API.',
        property: 'isBadRequestError' as const,
      },
      {
        status: 422,
        statusText: 'Validation Error',
        message: 'Validation error from InPost API.',
        property: 'isValidationError' as const,
      },
      {
        status: 429,
        statusText: 'Too Many Requests',
        message: 'Rate limit exceeded for InPost API.',
        property: 'isRateLimitError' as const,
      },
      {
        status: 500,
        statusText: 'Internal Server Error',
        message: 'InPost API server error.',
        property: 'isServerError' as const,
      },
    ])(
      'should identify $property for status $status',
      async ({ status, statusText, message, property }) => {
        const axiosError = createAxiosError({
          status,
          data: { message },
          statusText,
        });

        await expectAPIError(responseInterceptorError, axiosError, {
          statusCode: status,
          property,
        });
      },
    );
  });
});
