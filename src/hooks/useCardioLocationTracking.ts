import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { distanceMeters, type GeoCoordinate } from '@/lib/geo';

export type CardioGpsStatus = 'idle' | 'starting' | 'tracking' | 'denied' | 'unavailable';

const MAX_SEGMENT_METERS = 120;
const MAX_ACCURACY_METERS = 65;
const DISTANCE_STORAGE_KEY = 'liftflow_cardio_gps_distance_v1';

async function loadStoredDistance(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(DISTANCE_STORAGE_KEY);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

async function storeDistance(meters: number): Promise<void> {
  try {
    await AsyncStorage.setItem(DISTANCE_STORAGE_KEY, String(meters));
  } catch {
    // ignore
  }
}

export function useCardioLocationTracking(enabled: boolean) {
  const [distanceMetersTotal, setDistanceMetersTotal] = useState(0);
  const [status, setStatus] = useState<CardioGpsStatus>('idle');
  const lastPointRef = useRef<GeoCoordinate | null>(null);
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const distanceRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
      return;
    }

    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      setStatus('unavailable');
      return;
    }

    let cancelled = false;

    async function startTracking() {
      setStatus('starting');

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (cancelled) return;
      if (!servicesEnabled) {
        setStatus('unavailable');
        return;
      }

      const foreground = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (foreground.status !== Location.PermissionStatus.GRANTED) {
        setStatus('denied');
        return;
      }

      if (Platform.OS === 'ios') {
        await Location.requestBackgroundPermissionsAsync().catch(() => null);
      }

      const stored = await loadStoredDistance();
      if (!cancelled && stored > 0 && distanceRef.current === 0) {
        distanceRef.current = stored;
        setDistanceMetersTotal(stored);
      }

      try {
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 5,
            timeInterval: 2000,
            mayShowUserSettingsDialog: true,
            ...(Platform.OS === 'ios' ? { showsBackgroundLocationIndicator: true } : {}),
          },
          (position) => {
            const accuracy = position.coords.accuracy;
            if (accuracy != null && accuracy > MAX_ACCURACY_METERS) return;

            const point: GeoCoordinate = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };

            const previous = lastPointRef.current;
            lastPointRef.current = point;
            if (!previous) return;

            const segment = distanceMeters(previous, point);
            if (segment < 1 || segment > MAX_SEGMENT_METERS) return;

            distanceRef.current += segment;
            setDistanceMetersTotal(distanceRef.current);
            void storeDistance(distanceRef.current);
          },
        );

        if (cancelled) {
          subscription.remove();
          return;
        }

        subscriptionRef.current = subscription;
        setStatus('tracking');
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    }

    void startTracking();

    return () => {
      cancelled = true;
      subscriptionRef.current?.remove();
      subscriptionRef.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && enabled) {
        void loadStoredDistance().then((stored) => {
          if (stored > distanceRef.current) {
            distanceRef.current = stored;
            setDistanceMetersTotal(stored);
          }
        });
      }
    });
    return () => subscription.remove();
  }, [enabled]);

  function reset() {
    distanceRef.current = 0;
    setDistanceMetersTotal(0);
    lastPointRef.current = null;
    setStatus('idle');
    void AsyncStorage.removeItem(DISTANCE_STORAGE_KEY);
  }

  return {
    distanceMeters: distanceMetersTotal,
    status,
    reset,
  };
}
