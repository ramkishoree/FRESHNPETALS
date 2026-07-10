import { describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  AuthorizationError,
  BusinessRuleError,
  ExternalServiceError,
  InfrastructureError,
  isAppError,
  PaymentError,
  ValidationError,
} from './errors';

describe('AppError hierarchy', () => {
  it.each([
    [new ValidationError('bad input'), 'VALIDATION_ERROR', 422],
    [new AuthenticationError('sign in required'), 'AUTHENTICATION_ERROR', 401],
    [new AuthorizationError('forbidden'), 'AUTHORIZATION_ERROR', 403],
    [new BusinessRuleError('conflict'), 'BUSINESS_RULE_ERROR', 409],
    [new PaymentError('payment failed'), 'PAYMENT_ERROR', 402],
    [new InfrastructureError('db down'), 'INFRASTRUCTURE_ERROR', 500],
    [new ExternalServiceError('razorpay down'), 'EXTERNAL_SERVICE_ERROR', 502],
  ] as const)('%# assigns the correct code/httpStatus', (error, code, httpStatus) => {
    expect(error.code).toBe(code);
    expect(error.httpStatus).toBe(httpStatus);
    expect(isAppError(error)).toBe(true);
  });

  it('BusinessRuleError defaults to 409 but allows an httpStatus override (e.g. 404 not found)', () => {
    const conflict = new BusinessRuleError('duplicate SKU');
    expect(conflict.httpStatus).toBe(409);

    const notFound = new BusinessRuleError('product not found', { httpStatus: 404 });
    expect(notFound.httpStatus).toBe(404);
  });

  it('isAppError is false for a plain Error', () => {
    expect(isAppError(new Error('plain'))).toBe(false);
    expect(isAppError('not an error')).toBe(false);
    expect(isAppError(null)).toBe(false);
  });

  it('carries optional structured details', () => {
    const error = new ValidationError('invalid field', { field: 'email' });
    expect(error.details).toEqual({ field: 'email' });
  });
});
