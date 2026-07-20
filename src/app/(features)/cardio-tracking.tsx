/**
 * Redirect stub — in-app cardio tracking was removed.
 * Apple Fitness / HealthKit is the activity source for daily totals.
 */
import { Redirect } from 'expo-router';

export default function CardioTrackingRedirect() {
  return <Redirect href="/(features)/healthkit" />;
}
