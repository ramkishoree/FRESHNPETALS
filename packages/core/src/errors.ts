/**
 * Ch.11 §12: every error extends AppError. Internal stack traces are never
 * returned to clients (§12) — only code/message/correlationId/httpStatus
 * cross the API boundary; see apps/web/server/http/envelope.ts.
 */

export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'BUSINESS_RULE_ERROR'
  | 'PAYMENT_ERROR'
  | 'INFRASTRUCTURE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR';

export abstract class AppError extends Error {
  abstract readonly code: AppErrorCode;
  abstract readonly httpStatus: number;
  public correlationId?: string;

  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 422;
}

export class AuthenticationError extends AppError {
  readonly code = 'AUTHENTICATION_ERROR';
  readonly httpStatus = 401;
}

export class AuthorizationError extends AppError {
  readonly code = 'AUTHORIZATION_ERROR';
  readonly httpStatus = 403;
}

export class BusinessRuleError extends AppError {
  readonly code = 'BUSINESS_RULE_ERROR';
  readonly httpStatus: number;

  constructor(
    message: string,
    options?: { httpStatus?: number; details?: Record<string, unknown> },
  ) {
    super(message, options?.details);
    // Default 409 (Conflict) for a violated business rule; 404 (not found)
    // is the one common exception callers override — e.g.
    // `new BusinessRuleError('Product not found', { httpStatus: 404 })`.
    this.httpStatus = options?.httpStatus ?? 409;
  }
}

export class PaymentError extends AppError {
  readonly code = 'PAYMENT_ERROR';
  readonly httpStatus = 402;
}

export class InfrastructureError extends AppError {
  readonly code = 'INFRASTRUCTURE_ERROR';
  readonly httpStatus = 500;
}

export class ExternalServiceError extends AppError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly httpStatus = 502;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
