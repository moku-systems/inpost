// tests/unit/client/InPostClient.errorClassifications.test.ts
import { createAxiosError, expectAPIError, setupTestContext } from './helpers';

jest.mock('axios');
jest.mock('../../../src/auth/AuthManager');

describe('InPostClient – Error classifications', () => {
  const ctx = setupTestContext();

  it.each([
    {
      status: 401,
      statusText: 'Unauthorized',
      message: 'Unauthorized access to InPost API.',
      property: 'isAuthError' as const,
    },
    {
      status: 403,
      statusText: 'Forbidden',
      message: 'Unauthorized access to InPost API.',
      property: 'isAuthError' as const,
    },
    {
      status: 404,
      statusText: 'Not Found',
      message: 'Requested resource not found in InPost API.',
      property: 'isNotFoundError' as const,
    },
    {
      status: 400,
      statusText: 'Bad Request',
      message: 'Invalid request to InPost API.',
      property: 'isBadRequestError' as const,
    },
    {
      status: 422,
      statusText: 'Validation Error',
      message: 'Validation error from InPost API.',
      property: 'isValidationError' as const,
    },
    {
      status: 429,
      statusText: 'Too Many Requests',
      message: 'Rate limit exceeded for InPost API.',
      property: 'isRateLimitError' as const,
    },
    {
      status: 500,
      statusText: 'Internal Server Error',
      message: 'InPost API server error.',
      property: 'isServerError' as const,
    },
  ])(
    'should identify $property for status $status',
    async ({ status, statusText, message, property }) => {
      const axiosError = createAxiosError({
        status,
        data: { message },
        statusText,
      });

      await expectAPIError(ctx.responseInterceptorError, axiosError, {
        statusCode: status,
        property,
      });
    },
  );
});
