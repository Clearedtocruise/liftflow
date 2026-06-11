import { Alert, Linking } from 'react-native';

import { integrationService } from '@/services/integrationService';

type PostToStravaOptions = {
  userId: string;
  sessionId: string;
  onPosted?: (stravaUrl: string) => void;
};

/** Post a completed workout to Strava (strength, cardio, or any session type). */
export async function postWorkoutToStrava({ userId, sessionId, onPosted }: PostToStravaOptions): Promise<void> {
  const connected = await integrationService.isStravaConnected(userId);
  if (!connected) {
    Alert.alert(
      'Connect Strava',
      'Connect Strava in Settings → Apple Health & Watch to post workouts.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Connect',
          onPress: async () => {
            const result = await integrationService.connectStrava(userId);
            if (!result.success) Alert.alert('Strava', result.error);
          },
        },
      ],
    );
    return;
  }

  const result = await integrationService.exportWorkoutToStrava(sessionId);
  if (!result.success) {
    Alert.alert('Strava', result.error);
    return;
  }

  const { stravaUrl, alreadyPosted } = result.data;
  onPosted?.(stravaUrl);

  Alert.alert(
    alreadyPosted ? 'Already on Strava' : 'Posted to Strava',
    alreadyPosted ? 'This workout was already shared to your Strava feed.' : 'Your workout is now on Strava.',
    [
      { text: 'Done', style: 'cancel' },
      { text: 'View on Strava', onPress: () => void Linking.openURL(stravaUrl) },
    ],
  );
}
