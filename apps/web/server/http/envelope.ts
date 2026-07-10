import type { AppErrorCode } from '@prana/core';
import { NextResponse } from 'next/server';

/** Ch.11 §10: every /api/v1 endpoint returns this exact envelope shape. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  meta: Record<string, unknown> | null;
  error: { code: AppErrorCode; message: string; correlationId: string } | null;
}

export function apiSuccess<T>(
  data: T,
  options: { meta?: Record<string, unknown>; status?: number } = {},
): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json(
    { success: true, data, meta: options.meta ?? null, error: null },
    { status: options.status ?? 200 },
  );
}

export function apiError(
  code: AppErrorCode,
  message: string,
  httpStatus: number,
  correlationId: string,
): NextResponse<ApiEnvelope<null>> {
  return NextResponse.json(
    { success: false, data: null, meta: null, error: { code, message, correlationId } },
    { status: httpStatus },
  );
}
