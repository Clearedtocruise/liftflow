import { useCallback, useEffect, useState } from 'react';

import {
    isWorkoutLocationDetectionEnabled,
    PRIVACY_WORKOUT_LOCATION_DETECTION,
} from '@/constants/locationPreferences';
import { deviceLocationService, type LocationPermissionStatus, type NearbyWorkoutLocationMatch } from '@/services/deviceLocationService';
import { userService } from '@/services/userService';
import type { WorkoutLocation } from '@/types/workoutLocation';

type UseNearbyWorkoutLocationOptions = {
  userId: string | undefined;
  locations: WorkoutLocation[];
  enabled?: boolean;
  onMatch?: (match: NearbyWorkoutLocationMatch | null) => void;
};

export function useNearbyWorkoutLocation({
  userId,
  locations,
  enabled = true,
  onMatch,
}: UseNearbyWorkoutLocationOptions) {
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('undetermined');
  const [detectionEnabled, setDetectionEnabled] = useState(true);
  const [nearbyMatches, setNearbyMatches] = useState<NearbyWorkoutLocationMatch[]>([]);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreference = useCallback(async () => {
    if (!userId) return;
    const result = await userService.getPreferences(userId);
    if (result.success) {
      setDetectionEnabled(isWorkoutLocationDetectionEnabled(result.data.privacySettings));
    }
  }, [userId]);

  const refreshPermission = useCallback(async () => {
    const status = await deviceLocationService.getPermissionStatus();
    setPermissionStatus(status);
  }, []);

  const checkNearby = useCallback(async () => {
    if (!enabled || !detectionEnabled || !deviceLocationService.isSupported()) {
      setNearbyMatches([]);
      onMatch?.(null);
      return;
    }

    const withCoords = locations.filter((l) => l.latitude != null && l.longitude != null);
    if (withCoords.length === 0) {
      setNearbyMatches([]);
      onMatch?.(null);
      return;
    }

    setChecking(true);
    setError(null);
    const positionResult = await deviceLocationService.getCurrentPosition();
    setChecking(false);

    if (!positionResult.success) {
      setError(positionResult.error);
      setNearbyMatches([]);
      onMatch?.(null);
      await refreshPermission();
      return;
    }

    const matches = deviceLocationService.findNearbyWorkoutLocations(positionResult.data, withCoords);
    setNearbyMatches(matches);
    onMatch?.(matches[0] ?? null);
    await refreshPermission();
  }, [enabled, detectionEnabled, locations, onMatch, refreshPermission]);

  const requestPermission = useCallback(async () => {
    const result = await deviceLocationService.requestForegroundPermission();
    if (result.success) {
      setPermissionStatus(result.data);
      if (result.data === 'granted') await checkNearby();
    } else {
      setError(result.error);
    }
  }, [checkNearby]);

  const setDetectionPreference = useCallback(
    async (value: boolean) => {
      if (!userId) return;
      setDetectionEnabled(value);
      const prefs = await userService.getPreferences(userId);
      const current = prefs.success ? prefs.data.privacySettings ?? {} : {};
      await userService.updatePreferences(userId, {
        privacySettings: { ...current, [PRIVACY_WORKOUT_LOCATION_DETECTION]: value },
      });
      if (value) await checkNearby();
      else {
        setNearbyMatches([]);
        onMatch?.(null);
      }
    },
    [userId, checkNearby, onMatch],
  );

  useEffect(() => {
    loadPreference();
    refreshPermission();
  }, [loadPreference, refreshPermission]);

  const locationsKey = locations
    .map((l) => `${l.id}:${l.latitude ?? ''}:${l.longitude ?? ''}`)
    .join('|');

  useEffect(() => {
    if (enabled && detectionEnabled && locations.some((l) => l.latitude != null)) {
      checkNearby();
    }
  }, [enabled, detectionEnabled, locationsKey, checkNearby]);

  return {
    permissionStatus,
    detectionEnabled,
    nearbyMatches,
    nearestMatch: nearbyMatches[0] ?? null,
    checking,
    error,
    checkNearby,
    requestPermission,
    setDetectionPreference,
    openSettings: deviceLocationService.openAppSettings,
  };
};
