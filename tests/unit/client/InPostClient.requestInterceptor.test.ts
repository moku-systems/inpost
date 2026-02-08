// tests/unit/client/InPostClient.requestInterceptor.test.ts
import { setupTestContext } from './helpers';

jest.mock('axios');
jest.mock('../../../src/auth/AuthManager');

describe('InPostClient – Request Interceptor', () => {
  const ctx = setupTestContext();

  it('should add Authorization header with access token', async () => {
    const requestInterceptor =
      ctx.mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

    const config = { headers: {}, method: 'GET', url: '/test' };
    const result = await requestInterceptor(config);

    expect(ctx.mockAuthManager.getAccessToken).toHaveBeenCalled();
    expect(result.headers.Authorization).toBe('Bearer mock-access-token');
  });

  it('should refresh token if expired', async () => {
    ctx.mockAuthManager.getAccessToken
      .mockResolvedValueOnce('old-token')
      .mockResolvedValueOnce('new-token');

    const requestInterceptor =
      ctx.mockAxiosInstance.interceptors.request.use.mock.calls[0][0];

    const config1 = { headers: {}, method: 'GET', url: '/test1' };
    const config2 = { headers: {}, method: 'GET', url: '/test2' };

    await requestInterceptor(config1);
    await requestInterceptor(config2);

    expect(ctx.mockAuthManager.getAccessToken).toHaveBeenCalledTimes(2);
  });
});
