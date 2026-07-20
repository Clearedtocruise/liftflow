/**
 * Redirect stub — in-app extra activity logging was removed.
 * Apple Fitness / HealthKit is the activity source for daily totals.
 */
import { Redirect } from 'expo-router';

export default function LogActivityRedirect() {
  return <Redirect href="/(features)/healthkit" />;
}
