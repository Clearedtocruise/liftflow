export type GeoCoordinate = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_M = 6371000;

/** Haversine distance in meters between two WGS84 points. */
export function distanceMeters(a: GeoCoordinate, b: GeoCoordinate): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isWithinRadius(
  user: GeoCoordinate,
  target: GeoCoordinate,
  radiusMeters: number,
): boolean {
  return distanceMeters(user, target) <= radiusMeters;
}

export function defaultRadiusForLocationType(
  locationType: 'home_gym' | 'commercial_gym' | 'full_gym' | 'garage_gym' | 'planet_fitness' | string,
): number {
  return locationType === 'home_gym' ? 100 : 150;
}
