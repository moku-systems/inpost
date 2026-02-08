// tests/unit/client/InPostClient.errorHandling.test.ts
import { InPostAPIError } from '../../../src/utils/errors';
import { AxiosError } from 'axios';
import {
  BASE_REQUEST_CONFIG,
  createAxiosError,
  expectAPIError,
  setupTestContext,
} from './helpers';

jest.mock('axios');
jest.mock('../../../src/auth/AuthManager');

describe('InPostClient – Response Interceptor – Error Handling', () => {
  const ctx = setupTestContext();

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

    await expectAPIError(ctx.responseInterceptorError, axiosError, {
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

    await expectAPIError(ctx.responseInterceptorError, axiosError, {
      statusCode: 500,
      message: 'InPost API server error.',
      property: 'isServerError',
    });
  });

  it('should handle 401 and retry with new token', async () => {
    ctx.mockAxiosInstance.request.mockResolvedValue({
      data: { success: true },
    });

    ctx.mockAuthManager.getAccessToken
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

    const result = await ctx.responseInterceptorError(axiosError);

    expect(ctx.mockAuthManager.clearToken).toHaveBeenCalled();
    expect(ctx.mockAxiosInstance.request).toHaveBeenCalledWith(
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

    await expect(ctx.responseInterceptorError(axiosError)).rejects.toThrow(
      InPostAPIError,
    );
  });

  it('should handle network error (no response)', async () => {
    const axiosError = createAxiosError({
      hasResponse: false,
      hasRequest: true,
      message: 'Network Error',
    });

    await expectAPIError(ctx.responseInterceptorError, axiosError, {
      statusCode: 500,
      message: /No response from InPost API/,
    });
  });

  it('should handle unknown error', async () => {
    const axiosError: Partial<AxiosError> = {
      message: 'Something went wrong',
      isAxiosError: true,
    };

    await expectAPIError(ctx.responseInterceptorError, axiosError, {
      statusCode: 500,
      message: 'Something went wrong',
    });
  });
});
