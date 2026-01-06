import { ErrorData } from '../types/error';

export class InPostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InPostError';
    Object.setPrototypeOf(this, InPostError.prototype);
  }
}
export class InPostAPIError extends InPostError {
  public readonly statusCode: number;
  public readonly response: ErrorData;
  public readonly requestId?: string;

  constructor(
    message: string,
    statusCode: number,
    response: ErrorData,
    requestId?: string
  ) {
    super(message);
    this.name = 'InPostAPIError';
    this.statusCode = statusCode;
    this.response = response;
    this.requestId = requestId;
    Object.setPrototypeOf(this, InPostAPIError.prototype);
  }

  get isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  get isNotFoundError(): boolean {
    return this.statusCode === 404;
  }

  get isValidationError(): boolean {
    return this.statusCode === 400 || this.statusCode === 422;
  }

  get isRateLimitError(): boolean {
    return this.statusCode === 429;
  }

  get isServerError(): boolean {
    return this.statusCode >= 500 && this.statusCode < 600;
  }
}

export class InPostValidationError extends InPostError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown) {
    super(message);
    this.name = 'InPostValidationError';
    this.field = field;
    this.value = value;
    Object.setPrototypeOf(this, InPostValidationError.prototype);
  }
}

export class InPostConfigError extends InPostError {
  constructor(message: string) {
    super(message);
    this.name = 'InPostConfigError';
    Object.setPrototypeOf(this, InPostConfigError.prototype);
  }
}
