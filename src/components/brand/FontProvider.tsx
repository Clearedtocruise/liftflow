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

type FontProviderProps = {
  children: ReactNode;
};

export function FontProvider({ children }: FontProviderProps) {
  useSoraFonts({ Sora_700Bold, Sora_800ExtraBold });
  useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  useManropeFonts({ Manrope_500Medium, Manrope_600SemiBold });

  return children;
}
