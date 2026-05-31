import { useCallback, useEffect, useState } from 'react';

import type { HealthPermissionStatus } from '@/integrations/healthConstants';
import { healthService, type HealthServiceStatus, type HealthSyncReport } from '@/services/healthService';

type UseHealthSyncOptions = {
  userId?: string;
  autoLoadStatus?: boolean;
};

export function useHealthSync({ userId, autoLoadStatus = true }: UseHealthSyncOptions) {
  const [status, setStatus] = useState<HealthServiceStatus | null>(null);
  const [permission, setPermission] = useState<HealthPermissionStatus>('unknown');
  const [syncing, setSyncing] = useState(false);
  const [lastReport, setLastReport] = useState<HealthSyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!userId) return;
    const result = await healthService.getStatus(userId);
    if (result.success) {
      setStatus(result.data);
      setPermission(result.data.permission);
    }
  }, [userId]);

  useEffect(() => {
    if (autoLoadStatus) refreshStatus();
  }, [autoLoadStatus, refreshStatus]);

  const requestPermissions = useCallback(async () => {
    setError(null);
    const result = await healthService.requestPermissions();
    if (result.success) {
      setPermission(result.data);
      return result.data;
    }
    setError(result.error);
    return 'denied' as HealthPermissionStatus;
  }, []);

  const sync = useCallback(async (sinceDays = 30) => {
    if (!userId) return null;
    setSyncing(true);
    setError(null);
    const result = await healthService.sync(userId, sinceDays);
    setSyncing(false);
    if (result.success) {
      setLastReport(result.data);
      await refreshStatus();
      return result.data;
    }
    setError(result.error);
    return null;
  }, [userId, refreshStatus]);

  return {
    status,
    permission,
    syncing,
    lastReport,
    error,
    supportedTypes: healthService.getSupportedTypes(),
    typeLabels: healthService.getTypeLabels(),
    refreshStatus,
    requestPermissions,
    sync,
  };
}
