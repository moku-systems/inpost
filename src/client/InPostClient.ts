import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { InPostAPIError } from '../utils/errors';
import type { InPostConfig } from '../types/common';
import { AuthManager } from '../auth/AuthManager';
import { DEFAULT_CONFIG } from '../utils/config/defaults';
import { ErrorData } from '../types/error';
import { CommonApiErrorResponse } from '../types/api/errors';
import { buildUrl } from '../utils/api';

export class InPostClient {
  private readonly httpClient: AxiosInstance;
  private readonly authManager: AuthManager;
  private readonly environment: 'sandbox' | 'production';

  constructor(config: InPostConfig) {
    this.authManager = new AuthManager(config);
    this.environment = config.environment;

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

  private setupInterceptor(): void {
    //Add access token to each request
    this.httpClient.interceptors.request.use(
      async config => {
        const accessToken = await this.authManager.getAccessToken();
        config.headers.Authorization = `Bearer ${accessToken}`;
        return config;
      },
      error => {
        return Promise.reject(error);
      },
    );
    // RESPONSE INTERCEPTOR - Handle errors
    this.httpClient.interceptors.response.use(
      response => {
        return response;
      },
      async (error: AxiosError) => {
        // Handle 401 (token expired during request)
        if (error.response?.status === 401) {
          const config = error.config;
          // Clear token and retry once
          if (config && !config.headers['x-retry-count']) {
            this.authManager.clearToken();

            config.headers = config.headers || {};
            config.headers['x-retry-count'] = '1';
            // Retry with new token
            return this.httpClient.request(config);
          }
        }

        return Promise.reject(this.handleError(error));
      },
    );
  }

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
          errorData.errors.map(err => {
            errorNormalized.errors.push({ detail: err, type: 'unknown' });
          });
        }
        if (errorData.errors && typeof errorData.errors === 'object') {
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
