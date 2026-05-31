import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    useFonts as useInterFonts,
} from '@expo-google-fonts/inter';
import {
    Manrope_500Medium,
    Manrope_600SemiBold,
    useFonts as useManropeFonts,
} from '@expo-google-fonts/manrope';
import { Sora_700Bold, Sora_800ExtraBold, useFonts as useSoraFonts } from '@expo-google-fonts/sora';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand/LogoMark';
import { LiftFlowColors } from '@/constants/theme';

type FontProviderProps = {
  children: ReactNode;
};

export function FontProvider({ children }: FontProviderProps) {
  const [soraLoaded] = useSoraFonts({ Sora_700Bold, Sora_800ExtraBold });
  const [interLoaded] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [manropeLoaded] = useManropeFonts({ Manrope_500Medium, Manrope_600SemiBold });

  const ready = soraLoaded && interLoaded && manropeLoaded;

  if (!ready) {
    return (
      <View style={styles.loading}>
        <LogoMark size={72} glow animate />
        <ActivityIndicator color={LiftFlowColors.primary} style={styles.spinner} />
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LiftFlowColors.background,
    gap: 24,
  },
  spinner: {
    marginTop: 8,
  },
});
