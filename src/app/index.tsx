import { DIAGNOSTIC_B23, DIAGNOSTIC_B25, DIAGNOSTIC_B28 } from '@/config/startupFlags';

export default function Index() {
  if (DIAGNOSTIC_B28) {
    const { DiagnosticB28Home } = require('./DiagnosticB28Home') as typeof import('./DiagnosticB28Home');
    return <DiagnosticB28Home />;
  }

  if (DIAGNOSTIC_B25) {
    const { DiagnosticB25Screen } = require('./DiagnosticB25Screen') as typeof import('./DiagnosticB25Screen');
    return <DiagnosticB25Screen />;
  }

  if (DIAGNOSTIC_B23) {
    const { DiagnosticB23Screen } = require('./DiagnosticB23Screen') as typeof import('./DiagnosticB23Screen');
    return <DiagnosticB23Screen />;
  }

  const { default: AppIndex } = require('./index.app') as typeof import('./index.app');
  return <AppIndex />;
}
