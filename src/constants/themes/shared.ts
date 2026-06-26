import { Platform } from 'react-native';

import type { ThemeRadius, ThemeSpacing, TypographyScale } from './types';

export const Brand = {
  name: 'ONE MORE',
  appStoreName: 'One More Fitness',
  companyName: 'One More Fitness',
  planName: 'ONE MORE Pro',
  premiumName: 'ONE MORE Premium',
  coachName: 'ONE MORE Coach',
  taglinePrimary: 'Only One.',
  taglineSecondary: 'Only One.',
  heroHeadline: 'YOUR TRANSFORMATION STARTS WITH ONE MORE.',
} as const;

export const FontFamily = {
  hero: 'Sora_800ExtraBold',
  heroBold: 'Sora_700Bold',
  header: 'Inter_700Bold',
  headerSemi: 'Inter_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  label: 'Manrope_500Medium',
  labelSemi: 'Manrope_600SemiBold',
  metric: 'Inter_700Bold',
} as const;

export const Typography: TypographyScale = {
  hero: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: FontFamily.hero,
    letterSpacing: 0.3,
  },
  display: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: FontFamily.hero,
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: FontFamily.header,
  },
  headline: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: FontFamily.headerSemi,
  },
  body: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: FontFamily.body,
  },
  bodyBold: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: FontFamily.bodySemi,
  },
  callout: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: FontFamily.bodyMedium,
  },
  subhead: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FontFamily.bodyMedium,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FontFamily.body,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FontFamily.labelSemi,
    letterSpacing: 0.4,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FontFamily.labelSemi,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  metric: {
    fontSize: 40,
    lineHeight: 44,
    fontFamily: FontFamily.metric,
    letterSpacing: -0.5,
  },
  timer: {
    fontSize: 48,
    lineHeight: 52,
    fontFamily: FontFamily.body,
    letterSpacing: -1,
  },
};

export const darkSpacing: ThemeSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  massive: 64,
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
};

export const lightSpacing: ThemeSpacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  massive: 64,
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
};

export const darkRadius: ThemeRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const lightRadius: ThemeRadius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 24,
  full: 9999,
};

export const TouchTarget = {
  min: 48,
  comfortable: 56,
  large: 72,
} as const;

export const TabBarHeight = Platform.select({ ios: 84, android: 72, default: 72 }) ?? 72;

export const BottomTabInset = TabBarHeight;
export const MaxContentWidth = 480;

export const Fonts = Platform.select({
  ios: { sans: 'System', serif: 'Georgia', rounded: 'System', mono: 'Menlo' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: { sans: 'Inter, system-ui', serif: 'Georgia', rounded: 'system-ui', mono: 'monospace' },
});
