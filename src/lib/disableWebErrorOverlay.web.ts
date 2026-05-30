import { LogBox } from 'react-native';

LogBox.ignoreAllLogs(true);
LogBox.uninstall();

function logRuntimeError(label: string, error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`\n=== ${label} ===`);
  console.error(err.message);
  if (err.stack) {
    console.error(err.stack);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    logRuntimeError('LiftFlow runtime error', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    logRuntimeError('LiftFlow unhandled rejection', event.reason);
  });
}
