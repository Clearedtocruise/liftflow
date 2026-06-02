import { DIAGNOSTIC_B23, DIAGNOSTIC_B25, DIAGNOSTIC_B28 } from '@/config/startupFlags';

export default DIAGNOSTIC_B28
  ? require('./_layout.b28').default
  : DIAGNOSTIC_B25
    ? require('./_layout.b25').default
    : DIAGNOSTIC_B23
      ? require('./_layout.diagnostic').default
      : require('./_layout.app').default;
