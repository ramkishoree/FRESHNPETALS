import {
  type AppError,
  InfrastructureError,
  isErr,
  type Result,
  ValidationError,
} from '@prana/core';
import type { NextRequest } from 'next/server';
import type { z } from 'zod';
import { logger } from '@/server/logger';
import { apiError, apiSuccess } from './envelope';

/**
 * Ch.11 §11 (Route → Schema → Controller → Service) + §12 (every error maps
 * through AppError, no stack trace ever reaches the client) + §13
 * (structured request logging) as one composable wrapper, so every /api/v1
 * route gets the full pipeline by construction instead of by convention.
 */
export function createApiRoute<TQuery, TResult, TBody = undefined, TParams = undefined>(config: {
  querySchema?: z.ZodType<TQuery>;
  bodySchema?: z.ZodType<TBody>;
  handler: (context: {
    query: TQuery;
    body: TBody;
    params: TParams;
    request: NextRequest;
  }) => Promise<Result<TResult, AppError>>;
}) {
  return async function apiRouteHandler(
    request: NextRequest,
    params: TParams = undefined as TParams,
  ) {
    const correlationId = crypto.randomUUID();
    const startedAt = Date.now();
    const route = new URL(request.url).pathname;

    try {
      let query: TQuery = undefined as TQuery;
      if (config.querySchema) {
        const raw = Object.fromEntries(new URL(request.url).searchParams.entries());
        const parsed = config.querySchema.safeParse(raw);
        if (!parsed.success) {
          const error = new ValidationError('Invalid query parameters.', {
            issues: parsed.error.issues,
          });
          logger.warn('api.validation_failed', {
            route,
            correlationId,
            issues: parsed.error.issues,
          });
          return apiError(error.code, error.message, error.httpStatus, correlationId);
        }
        query = parsed.data;
      }

      let body: TBody = undefined as TBody;
      if (config.bodySchema) {
        const raw = await request.json().catch(() => undefined);
        const parsed = config.bodySchema.safeParse(raw);
        if (!parsed.success) {
          const error = new ValidationError('Invalid request body.', {
            issues: parsed.error.issues,
          });
          logger.warn('api.validation_failed', {
            route,
            correlationId,
            issues: parsed.error.issues,
          });
          return apiError(error.code, error.message, error.httpStatus, correlationId);
        }
        body = parsed.data;
      }

      const result = await config.handler({ query, body, params, request });
      const durationMs = Date.now() - startedAt;

      if (isErr(result)) {
        logger.error('api.error', {
          route,
          correlationId,
          durationMs,
          status: result.error.httpStatus,
          code: result.error.code,
          message: result.error.message,
          // `message` is the operator-facing summary; the real diagnosis
          // — a driver's error string, a failing constraint — lives in
          // `details`. Dropping it here is how a broken Postgres function
          // stayed hidden behind "Failed to start checkout." Logs are
          // server-side only and the logger redacts secret-shaped keys;
          // `details` still never crosses the API boundary (Ch.11 §12).
          ...(result.error.details ? { details: result.error.details } : {}),
        });
        return apiError(
          result.error.code,
          result.error.message,
          result.error.httpStatus,
          correlationId,
        );
      }

      logger.info('api.success', { route, correlationId, durationMs, status: 200 });
      return apiSuccess(result.value, { meta: { correlationId } });
    } catch (cause) {
      const durationMs = Date.now() - startedAt;
      const error = new InfrastructureError('Unexpected server error.');
      logger.error('api.unhandled_exception', {
        route,
        correlationId,
        durationMs,
        message: cause instanceof Error ? cause.message : String(cause),
      });
      return apiError(error.code, error.message, error.httpStatus, correlationId);
    }
  };
}
