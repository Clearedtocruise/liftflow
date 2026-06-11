import { Redirect } from 'expo-router';

/** Deep-link entry for cardio — routes to the Workout tab picker. */
export default function CardioTrackingScreen() {
  return <Redirect href={{ pathname: '/(tabs)/workout', params: { mode: 'cardio' } }} />;
}
