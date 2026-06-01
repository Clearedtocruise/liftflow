import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

import { distanceMeters, isWithinRadius, type GeoCoordinate } from '@/lib/geo';
import { fail, ok } from '@/lib/serviceResult';
import type { ServiceResult } from '@/types/common';
import type { WorkoutLocation } from '@/types/workoutLocation';

export type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export type NearbyWorkoutLocationMatch = {
  location: WorkoutLocation;
  distanceMeters: number;
};

export const deviceLocationService = {
  isSupported(): boolean {
    return Platform.OS === 'ios' || Platform.OS === 'android';
  },

  async getPermissionStatus(): Promise<LocationPermissionStatus> {
    if (!this.isSupported()) return 'unavailable';
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) return 'granted';
    if (status === Location.PermissionStatus.DENIED) return 'denied';
    return 'undetermined';
  },

  async requestForegroundPermission(): Promise<ServiceResult<LocationPermissionStatus>> {
    if (!this.isSupported()) {
      return fail('Location is available on iOS and Android only.');
    }

    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === Location.PermissionStatus.GRANTED) {
      return ok('granted');
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === Location.PermissionStatus.GRANTED) return ok('granted');
    if (status === Location.PermissionStatus.DENIED) return ok('denied');
    return ok('undetermined');
  },

  async getCurrentPosition(): Promise<ServiceResult<GeoCoordinate>> {
    if (!this.isSupported()) {
      return fail('Location is not supported on this platform.');
    }

    const perm = await this.requestForegroundPermission();
    if (!perm.success) return fail(perm.error);
    if (perm.data !== 'granted') {
      return fail('Location permission is required to detect your gym.');
    }

    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      return fail('Turn on Location Services in your device settings.');
    }

    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return ok({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Could not read GPS position');
    }
  },

  findNearbyWorkoutLocations(
    userPosition: GeoCoordinate,
    locations: WorkoutLocation[],
  ): NearbyWorkoutLocationMatch[] {
    const matches: NearbyWorkoutLocationMatch[] = [];

    for (const location of locations) {
      if (location.latitude == null || location.longitude == null) continue;
      const radius = location.radiusMeters ?? 150;
      const target = { latitude: location.latitude, longitude: location.longitude };
      const dist = distanceMeters(userPosition, target);
      if (isWithinRadius(userPosition, target, radius)) {
        matches.push({ location, distanceMeters: Math.round(dist) });
      }
    }

    return matches.sort((a, b) => a.distanceMeters - b.distanceMeters);
  },

  async openAppSettings(): Promise<void> {
    await Linking.openSettings();
  },
};
