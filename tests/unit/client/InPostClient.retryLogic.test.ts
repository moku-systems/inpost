// tests/unit/client/InPostClient.retryLogic.test.ts
import { InPostClient } from '../../../src/client/InPostClient';
import { InPostAPIError } from '../../../src/utils/errors';
import * as retryStrategy from '../../../src/client/retryStrategy';
import {
  BASE_REQUEST_CONFIG,
  DEFAULT_CLIENT_CONFIG,
  MockedAuthManager,
  createAxiosError,
  mockedAxios,
  setupTestContext,
} from './helpers';

jest.mock('axios');
jest.mock('../../../src/auth/AuthManager');
jest.mock('../../../src/client/retryStrategy', () => ({
  ...jest.requireActual('../../../src/client/retryStrategy'),
  sleep: jest.fn().mockResolvedValue(undefined),
}));

const mockedSleep = retryStrategy.sleep as jest.MockedFunction<
  typeof retryStrategy.sleep
>;

describe('InPostClient - Response Interceptor - Retry Logic', () => {
  const ctx = setupTestContext();

  describe('Retryable errors (429, 5xx)', () => {
    beforeEach(() => {
      mockedSleep.mockClear();
    });

    it('should retry 429 (rate limit) with exponential backoff', async () => {
      mockedSleep.mockClear();

      ctx.mockAxiosInstance.request.mockResolvedValue({
        data: { success: true },
      });

      // Simulate 3 sequential retries with increasing retry counts
      // and verify that sleep is called with exponential delays:
      // delay = retryDelay(1000) * 2^retryCount
      for (const [retryCount, expectedDelay] of [
        [0, 1000], // 1000 * 2^0
        [1, 2000], // 1000 * 2^1
        [2, 4000], // 1000 * 2^2
      ] as const) {
        mockedSleep.mockClear();

        const axiosError = createAxiosError({
          status: 429,
          data: { message: 'Rate limit exceeded for InPost API.' },
          statusText: 'Too Many Requests',
          config: {
            ...BASE_REQUEST_CONFIG,
            headers:
              retryCount > 0
                ? ({ 'x-retry-count': String(retryCount) } as any)
                : ({} as any),
          },
        });

        await ctx.responseInterceptorError(axiosError);

        expect(mockedSleep).toHaveBeenCalledTimes(1);
        expect(mockedSleep).toHaveBeenCalledWith(expectedDelay);
      }
    });

    it('should retry 503 (service unavailable) up to maxRetries', async () => {
      const axiosError = createAxiosError({
        status: 503,
        data: { message: 'InPost API server error.' },
        statusText: 'Service Unavailable',
        config: { ...BASE_REQUEST_CONFIG, headers: {} as any },
      });

      ctx.mockAxiosInstance.request.mockResolvedValue({
        data: { success: true },
      });

      const result = await ctx.responseInterceptorError(axiosError);

      expect(ctx.mockAxiosInstance.request).toHaveBeenCalledTimes(1);
      expect(ctx.mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-retry-count': '1',
          }),
        }),
      );
      expect(result).toEqual({ data: { success: true } });
    });

    it('should NOT retry after maxRetries reached', async () => {
      const axiosError = createAxiosError({
        status: 503,
        data: { detail: 'Service unavailable' },
        statusText: 'Service Unavailable',
        config: {
          ...BASE_REQUEST_CONFIG,
          headers: { 'x-retry-count': '3' } as any,
        },
      });

      await expect(ctx.responseInterceptorError(axiosError)).rejects.toThrow(
        InPostAPIError,
      );

      expect(ctx.mockAxiosInstance.request).not.toHaveBeenCalled();
    });

    it('should NOT retry 400 (bad request)', async () => {
      const axiosError = createAxiosError({
        status: 400,
        data: { detail: 'Bad request' },
        statusText: 'Bad Request',
        config: BASE_REQUEST_CONFIG,
      });

      await expect(ctx.responseInterceptorError(axiosError)).rejects.toThrow(
        InPostAPIError,
      );

      expect(ctx.mockAxiosInstance.request).not.toHaveBeenCalled();
    });
  });

  describe('Non-idempotent method safety', () => {
    it('should NOT retry POST requests on retryable status codes by default', async () => {
      const axiosError = createAxiosError({
        status: 503,
        data: { detail: 'Service unavailable' },
        statusText: 'Service Unavailable',
        config: {
          ...BASE_REQUEST_CONFIG,
          method: 'POST',
          headers: {} as any,
        },
      });

      await expect(ctx.responseInterceptorError(axiosError)).rejects.toThrow(
        InPostAPIError,
      );

      expect(ctx.mockAxiosInstance.request).not.toHaveBeenCalled();
    });

    it('should NOT retry PATCH requests on retryable status codes by default', async () => {
      const axiosError = createAxiosError({
        status: 429,
        data: { detail: 'Rate limited' },
        statusText: 'Too Many Requests',
        config: {
          ...BASE_REQUEST_CONFIG,
          method: 'PATCH',
          headers: {} as any,
        },
      });

      await expect(ctx.responseInterceptorError(axiosError)).rejects.toThrow(
        InPostAPIError,
      );

      expect(ctx.mockAxiosInstance.request).not.toHaveBeenCalled();
    });

    it('should still retry 401 (auth refresh) for POST requests', async () => {
      ctx.mockAxiosInstance.request.mockResolvedValue({
        data: { success: true },
      });

      const axiosError = createAxiosError({
        status: 401,
        data: { message: 'Unauthorized' },
        statusText: 'Unauthorized',
        config: {
          ...BASE_REQUEST_CONFIG,
          method: 'POST',
          headers: {} as any,
        },
      });

      const result = await ctx.responseInterceptorError(axiosError);

      expect(ctx.mockAuthManager.clearToken).toHaveBeenCalled();
      expect(ctx.mockAxiosInstance.request).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: { success: true } });
    });

    it.each(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'])(
      'should retry %s requests on retryable status codes',
      async method => {
        ctx.mockAxiosInstance.request.mockResolvedValue({
          data: { success: true },
        });

        const axiosError = createAxiosError({
          status: 503,
          data: { detail: 'Service unavailable' },
          statusText: 'Service Unavailable',
          config: {
            ...BASE_REQUEST_CONFIG,
            method,
            headers: {} as any,
          },
        });

        const result = await ctx.responseInterceptorError(axiosError);

        expect(ctx.mockAxiosInstance.request).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ data: { success: true } });
      },
    );

    it('should allow POST retries when explicitly opted in via config', async () => {
      jest.clearAllMocks();

      mockedAxios.create.mockReturnValue(ctx.mockAxiosInstance);
      MockedAuthManager.mockImplementation(() => ctx.mockAuthManager);
      ctx.mockAuthManager.getAccessToken.mockResolvedValue('mock-access-token');

      new InPostClient({
        ...DEFAULT_CLIENT_CONFIG,
        retryableHttpMethods: [
          'GET',
          'HEAD',
          'PUT',
          'DELETE',
          'OPTIONS',
          'POST',
        ],
      });

      const postRetryInterceptor =
        ctx.mockAxiosInstance.interceptors.response.use.mock.calls[0][1];

      mockedSleep.mockClear();

      ctx.mockAxiosInstance.request.mockResolvedValue({
        data: { success: true },
      });

      const axiosError = createAxiosError({
        status: 503,
        data: { detail: 'Service unavailable' },
        statusText: 'Service Unavailable',
        config: {
          ...BASE_REQUEST_CONFIG,
          method: 'POST',
          headers: {} as any,
        },
      });

      const result = await postRetryInterceptor(axiosError);

      expect(ctx.mockAxiosInstance.request).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ data: { success: true } });
    });
  });
});
