import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { VOICE_STABILIZATION_MESSAGE } from '@/constants/stabilization';
import { Spacing } from '@/constants/theme';

type VoiceUnavailableMessageProps = {
  message?: string;
};

export function VoiceUnavailableMessage({
  message = VOICE_STABILIZATION_MESSAGE,
}: VoiceUnavailableMessageProps) {
  return (
    <View style={{ alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md }}>
      <AppText variant="caption" color="textSecondary" align="center">
        {message}
      </AppText>
    </View>
  );
}
