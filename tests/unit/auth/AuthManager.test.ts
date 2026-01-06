import axios from 'axios';
import { AuthManager } from '../../../src/auth/AuthManager';
import { InPostConfigError } from '../../../src/utils/errors';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AuthManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw InPostConfigError if config is missing clientId', () => {
      expect(
        () =>
          new AuthManager({
            clientId: '',
            clientSecret: 'secret',
            environment: 'sandbox',
            scope: ['api:points:read'],
          })
      ).toThrow(InPostConfigError);
    });

    it('should throw InPostConfigError if config is missing clientSecret', () => {
      expect(
        () =>
          new AuthManager({
            clientId: 'client-id',
            clientSecret: '',
            environment: 'sandbox',
            scope: ['api:points:read'],
          })
      ).toThrow(InPostConfigError);
    });
  });
  describe('getAccessToken', () => {
    it('should fetch and cache access token', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const authManager = new AuthManager({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        environment: 'sandbox',
        scope: ['api:points:read'],
      });

      const token = await authManager.getAccessToken();

      expect(token).toBe('test-token');
    });

    it('should return cached token if still valid', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const mockPost = jest.fn().mockResolvedValue(mockResponse);
      mockedAxios.create.mockReturnValue({
        post: mockPost,
      } as any);

      const authManager = new AuthManager({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        environment: 'sandbox',
        scope: ['api:points:read'],
        tokenRefreshBuffer: 300,
      });

      // First call - fetches token
      await authManager.getAccessToken();
      expect(mockPost).toHaveBeenCalledTimes(1);

      // Second call - uses cache
      await authManager.getAccessToken();
      expect(mockPost).toHaveBeenCalledTimes(1); // Still 1!
    });

    it('should refresh token when expiring soon', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 100, // Expires in 100 seconds
        },
      };

      const mockPost = jest.fn().mockResolvedValue(mockResponse);
      mockedAxios.create.mockReturnValue({
        post: mockPost,
      } as any);

      const authManager = new AuthManager({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        environment: 'sandbox',
        scope: ['api:points:read'],
        tokenRefreshBuffer: 200, // Refresh 200 seconds before expiry
      });

      // First call
      await authManager.getAccessToken();
      expect(mockPost).toHaveBeenCalledTimes(1);

      // Token expires in 100s, buffer is 200s = should refresh
      await authManager.getAccessToken();
      expect(mockPost).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshToken', () => {
    it('should force token refresh', async () => {
      const mockResponse = {
        data: {
          access_token: 'new-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      const mockPost = jest.fn().mockResolvedValue(mockResponse);
      mockedAxios.create.mockReturnValue({
        post: mockPost,
      } as any);

      const authManager = new AuthManager({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        environment: 'sandbox',
        scope: ['api:points:read'],
      });

      const token = await authManager.refreshToken();

      expect(token.accessToken).toBe('new-token');
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('onTokenRefresh callback', () => {
    it('should call callback when token is refreshed', async () => {
      const mockResponse = {
        data: {
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 3600,
        },
      };

      mockedAxios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      const onTokenRefresh = jest.fn();

      const authManager = new AuthManager({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        environment: 'sandbox',
        scope: ['api:points:read'],
        onTokenRefresh,
      });

      await authManager.getAccessToken();

      expect(onTokenRefresh).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'test-token',
          tokenType: 'Bearer',
        })
      );
    });
  });
});
