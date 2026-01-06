import axios, { AxiosInstance } from 'axios';
import { InPostConfigError, InPostAPIError } from '../utils/errors';
import type { InPostConfig } from '../types/common';
import { buildUrl } from '../utils/api/hosts';
import { DEFAULT_CONFIG } from '../utils/config/defaults';
import { AuthApiResponse } from '../types/api/auth';
import { ENDPOINTS } from '../utils/api';
import { AccessToken } from '../types/auth';
import { AuthApiErrorResponse } from '../types/api/errors';
export class AuthManager {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly scopes: string[];
  private readonly authUrl: string;
  private readonly tokenRefreshBuffer: number;
  private readonly onTokenRefresh?: (token: AccessToken) => void;

  private currentToken?: AccessToken;
  private refreshPromise?: Promise<AccessToken>;
  private httpClient: AxiosInstance;

  constructor(config: InPostConfig) {
    if (!config.clientId || config.clientId.trim().length === 0) {
      throw new InPostConfigError(
        'Client ID is required in the configuration.'
      );
    }
    if (!config.clientSecret || config.clientSecret.trim().length === 0) {
      throw new InPostConfigError(
        'Client Secret is required in the configuration.'
      );
    }
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.scopes = config.scope;

    this.authUrl = buildUrl(config.environment, ENDPOINTS.auth.token);
    this.tokenRefreshBuffer =
      config.tokenRefreshBuffer ?? DEFAULT_CONFIG.tokenRefreshBuffer;
    this.onTokenRefresh = config.onTokenRefresh;

    this.httpClient = axios.create({
      baseURL: this.authUrl,
      timeout: config.timeout ?? DEFAULT_CONFIG.timeout,
    });
  }

  /**
   * Gets a valid access token, refreshing it if necessary.
   * @return Promise<string> - valid access token
   */
  public async getAccessToken(): Promise<string> {
    //return valid token if exists and not expiring soon
    if (this.currentToken && !this.isTokenExpiringSoon(this.currentToken)) {
      return this.currentToken.accessToken;
    }

    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      const token = await this.refreshPromise;
      return token.accessToken;
    }

    // Otherwise, start a new refresh
    this.refreshPromise = this.fetchAccessToken();
    try {
      const token = await this.refreshPromise;
      return token.accessToken;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  /**
   * Fetches a new access token from the InPost auth endpoint
   * @returns Promise<AccessToken> - new access token
   */
  private async fetchAccessToken(): Promise<AccessToken> {
    try {
      const response = await this.httpClient.post<AuthApiResponse>(
        this.authUrl,
        new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
          scope: this.scopes.join(' '), // Add required scopes
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const token: AccessToken = {
        accessToken: response.data.access_token,
        tokenType: 'Bearer',
        expiresIn: response.data.expires_in,
        expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        scope: response.data.scope,
      };

      this.currentToken = token;

      // Callback
      if (this.onTokenRefresh) {
        this.onTokenRefresh(token);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(
          '[InPost Auth] Token acquired, expires at:',
          token.expiresAt
        );
      }

      return token;
    } catch (error) {
      const errorData: AuthApiErrorResponse =
        axios.isAxiosError(error) && error.response
          ? error.response.data
          : {
              error: 'Authentication failed',
              error_description: 'Unknown error',
            };
      throw new InPostAPIError('Authentication failed', 401, {
        message: errorData.error_description,
        errors: [{ detail: errorData.error }],
      });
    }
  }

  /**
   *
   * Check if the token is expiring within the buffer time
   * @param token
   * @returns boolean - true if token is expiring within the buffer time
   */
  private isTokenExpiringSoon(token: AccessToken): boolean {
    const now = new Date();
    const bufferTime = new Date(
      token.expiresAt.getTime() - this.tokenRefreshBuffer * 1000
    );
    return now >= bufferTime;
  }

  /**
   * Force refresh the access token
   * @returns Promise<AccessToken> - new access token
   */
  async refreshToken(): Promise<AccessToken> {
    this.currentToken = await this.fetchAccessToken();
    return this.currentToken;
  }

  /**
   * Clear the current token
   */
  clearToken(): void {
    this.currentToken = undefined;
  }

  /**
   * Get current token info if any (only for debugging/testing)
   * Access token may be undefined if not yet fetched
   * Available only on development mode
   * @returns AccessToken | undefined - current token info or undefined
   */
  getTokenInfo(): AccessToken | undefined {
    if (process.env.NODE_ENV !== 'development') {
      return undefined;
    }
    return this.currentToken;
  }
}
