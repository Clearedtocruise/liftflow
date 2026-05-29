import type { ServiceResult } from '@/types/common';

export function ok<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

export function fail<T>(error: string): ServiceResult<T> {
  return { success: false, error };
}

export function fromError<T>(error: unknown): ServiceResult<T> {
  const message = error instanceof Error ? error.message : 'Unknown error';
  return fail(message);
}
