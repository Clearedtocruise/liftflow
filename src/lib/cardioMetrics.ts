import type { DistanceUnit } from '@/constants/units';
import type { CardioType } from '@/types/common';

const KM_PER_MI = 1.609344;

export function supportsSteadyDistanceMetrics(cardioType: CardioType): boolean {
  return cardioType === 'walk' || cardioType === 'run' || cardioType === 'cycle';
}

function formatDurationMinutes(totalMinutes: number): string {
  const mins = Math.floor(totalMinutes);
  const secs = Math.round((totalMinutes - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Average pace as min:sec per km or mi. */
export function formatPace(
  durationSeconds: number,
  distanceMeters: number,
  unit: DistanceUnit,
): string | null {
  if (distanceMeters <= 0 || durationSeconds <= 0) return null;

  const distanceKm = distanceMeters / 1000;
  const paceMinPerKm = durationSeconds / 60 / distanceKm;
  if (!Number.isFinite(paceMinPerKm) || paceMinPerKm <= 0) return null;

  if (unit === 'km') {
    return `${formatDurationMinutes(paceMinPerKm)} /km`;
  }

  return `${formatDurationMinutes(paceMinPerKm * KM_PER_MI)} /mi`;
}

/** Average speed as km/h or mph. */
export function formatSpeed(
  durationSeconds: number,
  distanceMeters: number,
  unit: DistanceUnit,
): string | null {
  if (distanceMeters <= 0 || durationSeconds <= 0) return null;

  const speedKmh = (distanceMeters / durationSeconds) * 3.6;
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) return null;

  if (unit === 'km') {
    return `${(Math.round(speedKmh * 10) / 10).toFixed(1)} km/h`;
  }

  const speedMph = speedKmh / KM_PER_MI;
  return `${(Math.round(speedMph * 10) / 10).toFixed(1)} mph`;
}

/** Live distance readout for in-session display. */
export function formatLiveDistance(distanceMeters: number, unit: DistanceUnit): string {
  if (distanceMeters <= 0) {
    return unit === 'km' ? '0.00 km' : '0.00 mi';
  }

  const km = distanceMeters / 1000;
  if (unit === 'km') {
    const value = km < 10 ? (Math.round(km * 100) / 100).toFixed(2) : (Math.round(km * 10) / 10).toFixed(1);
    return `${value} km`;
  }

  const mi = km / KM_PER_MI;
  const value = mi < 10 ? (Math.round(mi * 100) / 100).toFixed(2) : (Math.round(mi * 10) / 10).toFixed(1);
  return `${value} mi`;
}
