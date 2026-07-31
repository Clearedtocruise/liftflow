import type { ServiceResult } from '@/types/common';

export function ok<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

export function fail<T>(error: string, code?: string): ServiceResult<T> {
  return code ? { success: false, error, code } : { success: false, error };
}

export function fromError<T>(error: unknown): ServiceResult<T> {
  const message = error instanceof Error ? error.message : 'Unknown error';
  // Preserve the backend's error code so callers can tell a paywall from an outage.
  const code =
    typeof error === 'object' && error != null && 'code' in error
      ? ((error as { code?: unknown }).code as string | undefined)
      : undefined;
  return fail(message, typeof code === 'string' ? code : undefined);
}
