import { AxiosError } from 'axios';
import { InPostAPIError } from '../utils/errors';
import type { ErrorData } from '../types/error';
import type { CommonApiErrorResponse } from '../types/api/errors';

/**
 * Map HTTP status codes to human-readable error messages
 */
const STATUS_MESSAGE_MAP: Record<number, string> = {
  400: 'Invalid request to InPost API.',
  401: 'Unauthorized access to InPost API.',
  403: 'Unauthorized access to InPost API.',
  404: 'Requested resource not found in InPost API.',
  422: 'Validation error from InPost API.',
  429: 'Rate limit exceeded for InPost API.',
  500: 'InPost API server error.',
  502: 'InPost API server error.',
  503: 'InPost API server error.',
  504: 'InPost API server error.',
};

/**
 * Normalize API error response data into a consistent ErrorData structure
 * @param data - Raw response data from the API
 * @param message - Default error message
 * @returns Normalized ErrorData object
 */
function normalizeErrorData(data: unknown, message: string): ErrorData {
  const errorNormalized: ErrorData = {
    message,
    errors: [],
  };

  if (typeof data !== 'object' || data === null) {
    return errorNormalized;
  }

  const errorData = data as CommonApiErrorResponse;

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

  return errorNormalized;
}

/**
 * Handle errors from Axios and convert them to InPostAPIError with normalized error data.
 * This is a pure function with no side effects.
 * @param error - AxiosError object
 * @returns InPostAPIError instance
 */
export function handleError(error: AxiosError): InPostAPIError {
  if (error.response) {
    const { status, data, headers } = error.response;
    const requestId = headers['x-request-id'] as string | undefined;
    const message = STATUS_MESSAGE_MAP[status] ?? 'Unknown error occurred';
    const errorNormalized = normalizeErrorData(data, message);

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
