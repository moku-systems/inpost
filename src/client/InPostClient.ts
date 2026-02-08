import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { InPostAPIError } from '../utils/errors';
import type { InPostConfig } from '../types/common';
import { AuthManager } from '../auth/AuthManager';
import { DEFAULT_CONFIG, RETRY_CONFIG } from '../utils/config/defaults';
import { ErrorData } from '../types/error';
import { CommonApiErrorResponse } from '../types/api/errors';
import { buildUrl } from '../utils/api';

export class InPostClient {
  private readonly httpClient: AxiosInstance;
  private readonly authManager: AuthManager;
  private readonly environment: 'sandbox' | 'production';
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly retryableStatusCodes: readonly number[];

  constructor(config: InPostConfig) {
    this.authManager = new AuthManager(config);
    this.environment = config.environment;
    this.maxRetries = config.maxRetries ?? RETRY_CONFIG.maxRetries;
    this.retryDelay = config.retryDelay ?? RETRY_CONFIG.retryDelay;
    this.retryableStatusCodes =
      config.retryableStatusCodes ?? RETRY_CONFIG.retryableStatusCodes;

    const baseURL = buildUrl(this.environment, '');

    this.httpClient = axios.create({
      baseURL: baseURL,
      timeout: config.timeout || DEFAULT_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.setupInterceptor();
  }

  /**
   * Setup Axios interceptors for request and response handling
   */
  private setupInterceptor(): void {
    //Add access token to each request
    this.httpClient.interceptors.request.use(
      async config => {
        const accessToken = await this.authManager.getAccessToken();
        config.headers.Authorization = `Bearer ${accessToken}`;
        return config;
      },
      error => Promise.reject(error),
    );

    // RESPONSE INTERCEPTOR - Handle errors
    this.httpClient.interceptors.response.use(
      response => response,
      async (error: AxiosError) => {
        const config = error.config;
        const status = error.response?.status;

        if (!config || !status) {
          return Promise.reject(this.handleError(error));
        }

        // Get current retry count from headers (default to 0)
        const retryCount = parseInt(config.headers['x-retry-count'] || 0);

        // Handle 401 (token expired during request) - retry once after refreshing token
        if (status === 401 && retryCount === 0) {
          this.authManager.clearToken();

          config.headers = config.headers || {};
          config.headers['x-retry-count'] = '1';
          // Retry with new token
          return this.httpClient.request(config);
        }

        if (
          status &&
          this.retryableStatusCodes.includes(status) &&
          retryCount < this.maxRetries
        ) {
          const delay = this.calculateRetryDelay(retryCount, status);
          await this.sleep(delay);
          // Increment retry count
          config.headers = config.headers || {};
          config.headers['x-retry-count'] = String(retryCount + 1);

          // Retry the request
          return this.httpClient.request(config);
        }

        return Promise.reject(this.handleError(error));
      },
    );
  }

  /**
   * Calculate retry delay using exponential backoff strategy
   * @param retryCount - Current retry attempt count
   * @param status - HTTP status code of the failed request
   * @returns Delay in milliseconds before the next retry attempt
   */
  private calculateRetryDelay(retryCount: number, status: number): number {
    // For 429 Too Many Requests, use exponential backoff with an additional fixed delay to help mitigate rate limits
    if (status === 429) {
      return this.retryDelay * Math.pow(2, retryCount);
    }
    return this.retryDelay * (retryCount + 1);
  }

  /**
   * Delay execution for a specified number of milliseconds
   * @param ms - Number of milliseconds to sleep
   * @returns Promise that resolves after the specified delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle errors from Axios and convert them to InPostAPIError with normalized error data
   * @param error - AxiosError object
   * @returns InPostAPIError instance
   */
  private handleError(error: AxiosError): InPostAPIError {
    if (error.response) {
      const { status, data, headers } = error.response;
      const requestId = headers['x-request-id'] as string | undefined;

      let message = 'Unknown error occurred';
      switch (status) {
        case 400:
          message = 'Invalid request to InPost API.';
          break;
        case 422:
          message = 'Validation error from InPost API.';
          break;
        case 401:
        case 403:
          message = 'Unauthorized access to InPost API.';
          break;
        case 404:
          message = 'Requested resource not found in InPost API.';
          break;
        case 429:
          message = 'Rate limit exceeded for InPost API.';
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          message = 'InPost API server error.';
          break;
        default:
          break;
      }

      let errorNormalized: ErrorData = {
        message,
        errors: [],
      };

      if (typeof data === 'object' && data !== null) {
        const errorData: CommonApiErrorResponse = data as any;
        if (errorData.detail) {
          errorNormalized.message = errorData.detail;
          errorNormalized.type = errorData.type;
        }
        if (Array.isArray(errorData.errors)) {
          errorData.errors.forEach(err => {
            errorNormalized.errors.push({ detail: err, type: 'unknown' });
          });
        } else if (
          errorData.errors &&
          typeof errorData.errors === 'object' &&
          !Array.isArray(errorData.errors)
        ) {
          Object.entries(errorData.errors).flatMap(
            ([field, messages]: [string, string[]]) => {
              messages.forEach(msg => {
                errorNormalized.errors.push({ detail: field, type: msg });
              });
            },
          );
        }
      }

      return new InPostAPIError(message, status, errorNormalized, requestId);
    }

    if (error.request) {
      return new InPostAPIError('No response from InPost API.', 500, {
        message: 'No response received',
        errors: [],
      });
    }

    return new InPostAPIError(
      error.message || 'Unexpected error occurred.',
      error!.status || 500,
      {
        message: error.message,
        errors: [{ detail: error.stack || 'Unexpected error occurred.' }],
      },
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.httpClient.get<T>(url, config);
    return response.data;
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.httpClient.post<T>(url, data, config);
    return response.data;
  }
}
