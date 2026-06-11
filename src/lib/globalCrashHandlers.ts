import { Platform } from 'react-native';

import { installCrashDiagnostics, markCrashMarker, recordCrashError } from '@/lib/crashDiagnostics';

type GlobalWithErrorUtils = typeof globalThis & {
  ErrorUtils?: {
    getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
    setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
  };
  HermesInternal?: unknown;
  onunhandledrejection?: ((event: PromiseRejectionEvent) => void) | null;
};

let handlersInstalled = false;

function installUnhandledPromiseRejectionHandler(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rejectionTracking = require('promise/setimmediate/rejection-tracking') as {
      enable: (options: {
        allRejections: boolean;
        onUnhandled: (id: string, error: unknown) => void;
        onHandled: (id: string) => void;
      }) => void;
    };
    rejectionTracking.enable({
      allRejections: true,
      onUnhandled: (_id, error) => {
        recordCrashError(error, { source: 'unhandled_promise_rejection', fatal: false });
      },
      onHandled: () => {
        // no-op
      },
    });
    markCrashMarker('CRASH_HANDLER_PROMISE', { installed: true });
  } catch (e) {
    markCrashMarker('CRASH_HANDLER_PROMISE_FAILED', {
      error: e instanceof Error ? e.message : 'promise handler failed',
    });
  }
}

function installFatalErrorHandler(): void {
  const globalRef = globalThis as GlobalWithErrorUtils;
  const errorUtils = globalRef.ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) {
    markCrashMarker('CRASH_HANDLER_FATAL_UNAVAILABLE');
    return;
  }

  const defaultHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    recordCrashError(error, {
      source: isFatal ? 'react_native_fatal' : 'react_native_error',
      fatal: Boolean(isFatal),
    });
    defaultHandler(error, isFatal);
  });
  markCrashMarker('CRASH_HANDLER_FATAL', { installed: true, platform: Platform.OS });
}

export function installGlobalCrashHandlers(): void {
  if (handlersInstalled || Platform.OS === 'web') return;
  handlersInstalled = true;
  installCrashDiagnostics();
  installFatalErrorHandler();
  installUnhandledPromiseRejectionHandler();
  markCrashMarker('CRASH_HANDLERS_INSTALLED');
}
