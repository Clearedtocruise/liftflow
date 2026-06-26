import type { TextStyle } from 'react-native';

export type ThemeId = 'dark-classic' | 'light-professional';

export type ThemeColorPalette = {
  background: string;
  backgroundSecondary: string;
  backgroundElevated: string;
  surface: string;
  surfaceElevated: string;
  surfaceHighlight: string;
  surfaceSoft: string;
  card: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  primary: string;
  primaryMuted: string;
  primarySoft: string;
  primaryGlow: string;
  onPrimary: string;
  accent: string;
  accentMuted: string;
  accentGlow: string;
  legacyAccent: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  danger: string;
  restTimer: string;
  restTimerMuted: string;
  gradientStart: string;
  gradientEnd: string;
  glass: string;
  overlay: string;
  shadow: string;
  microphoneRing: string;
  microphoneFill: string;
  microphoneGlow: string;
  tabBar: string;
  tabBarBorder: string;
  tabInactive: string;
  tabActive: string;
  onPhoto: string;
  onPhotoMuted: string;
};

export type ThemeRadius = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  full: number;
};

export type ThemeSpacing = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
  huge: number;
  massive: number;
  half: number;
  one: number;
  two: number;
  three: number;
  four: number;
  five: number;
  six: number;
};

export type ThemeShadows = {
  card: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  glow: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  tabBar: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
};

export type BrandGradientSet = {
  border: {
    default: readonly [string, string];
    subtle: readonly [string, string];
    bold: readonly [string, string];
  };
  button: readonly [string, string];
  insightFill: readonly [string, string];
  photoOverlay: readonly [string, string];
  ambient: readonly [string, string];
};

export type AppTheme = {
  id: ThemeId;
  label: string;
  isDark: boolean;
  statusBarStyle: 'light' | 'dark';
  colors: ThemeColorPalette;
  radius: ThemeRadius;
  spacing: ThemeSpacing;
  shadows: ThemeShadows;
  brandGradients: BrandGradientSet;
  navigationTheme: {
    dark: boolean;
    colors: {
      primary: string;
      background: string;
      card: string;
      text: string;
      border: string;
      notification: string;
    };
  };
};

export type TypographyScale = Record<
  string,
  TextStyle & { fontFamily: string }
>;
