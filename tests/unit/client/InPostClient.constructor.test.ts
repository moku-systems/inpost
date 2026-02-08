// tests/unit/client/InPostClient.constructor.test.ts
import { InPostClient } from '../../../src/client/InPostClient';
import { INPOST_HOSTS } from '../../../src/utils/api';
import {
  DEFAULT_CLIENT_CONFIG,
  mockedAxios,
  setupTestContext,
} from './helpers';

jest.mock('axios');
jest.mock('../../../src/auth/AuthManager');

describe('InPostClient – constructor', () => {
  const ctx = setupTestContext();

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
    expect(ctx.mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    expect(ctx.mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
  });
});
