import { Platform } from 'react-native';

/** LiftFlow Sprint 5.0 — Premium performance brand system */
export const LiftFlowColors = {
  background: '#080B10',
  backgroundSecondary: '#111318',
  backgroundElevated: '#111318',
  surface: '#171B22',
  surfaceElevated: '#1E2430',
  surfaceHighlight: '#252C3A',
  border: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',

  textPrimary: '#FFFFFF',
  textSecondary: '#A6B0C3',
  textTertiary: '#6B7589',
  textMuted: '#4A5366',

  primary: '#0E90FF',
  primaryMuted: '#0B73CC',
  primaryGlow: 'rgba(14, 144, 255, 0.22)',

  accent: '#0E90FF',
  accentMuted: '#0B73CC',
  accentGlow: 'rgba(14, 144, 255, 0.15)',

  /** @deprecated use primary — kept for gradual migration */
  legacyAccent: '#1F6BFF',

  success: '#00E5A8',
  warning: '#FFC857',
  error: '#FF5B5B',

  restTimer: '#00E5FF',
  restTimerMuted: 'rgba(0, 229, 255, 0.12)',

  gradientStart: '#1F6BFF',
  gradientEnd: '#00E5FF',

  glass: 'rgba(23, 27, 34, 0.72)',
  overlay: 'rgba(8, 11, 16, 0.85)',

  microphoneRing: '#1F6BFF',
  microphoneFill: '#171B22',
  microphoneGlow: 'rgba(31, 107, 255, 0.35)',

  tabBar: '#080B10',
  tabBarBorder: '#111318',
  tabInactive: '#6B7589',
  tabActive: '#00E5FF',
} as const;

export type LiftFlowColor = keyof typeof LiftFlowColors;

/** System fonts — no expo-font / ExpoFontLoader required. */
const systemFont = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) ?? 'System';

export const FontFamily = {
  hero: systemFont,
  heroBold: systemFont,
  header: systemFont,
  headerSemi: systemFont,
  body: systemFont,
  bodyMedium: systemFont,
  bodySemi: systemFont,
  label: systemFont,
  labelSemi: systemFont,
  metric: systemFont,
} as const;

export const Typography = {
  hero: {
    fontSize: 34,
    lineHeight: 40,
    fontFamily: FontFamily.hero,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  display: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: FontFamily.hero,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: FontFamily.header,
    fontWeight: '700',
  },
  headline: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: FontFamily.headerSemi,
    fontWeight: '600',
  },
  body: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: FontFamily.body,
    fontWeight: '400',
  },
  bodyBold: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: FontFamily.bodySemi,
    fontWeight: '600',
  },
  callout: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: FontFamily.bodyMedium,
    fontWeight: '500',
  },
  subhead: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FontFamily.bodyMedium,
    fontWeight: '500',
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FontFamily.body,
    fontWeight: '400',
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FontFamily.labelSemi,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FontFamily.labelSemi,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  metric: {
    fontSize: 40,
    lineHeight: 44,
    fontFamily: FontFamily.metric,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  timer: {
    fontSize: 48,
    lineHeight: 52,
    fontFamily: FontFamily.body,
    fontWeight: '400',
    letterSpacing: -1,
  },
} as const;

export const Spacing = {
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
} as const;

export const TouchTarget = {
  min: 48,
  comfortable: 56,
  large: 72,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: LiftFlowColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

export const TabBarHeight = Platform.select({ ios: 84, android: 72, default: 72 }) ?? 72;

export const NavigationTheme = {
  dark: true,
  colors: {
    primary: LiftFlowColors.primary,
    background: LiftFlowColors.background,
    card: LiftFlowColors.surface,
    text: LiftFlowColors.textPrimary,
    border: LiftFlowColors.border,
    notification: LiftFlowColors.primary,
  },
} as const;

export const Brand = {
  /** In-app display name */
  name: 'ONE MORE',
  /** App Store Connect listing name */
  appStoreName: 'One More Fitness',
  companyName: 'One More Fitness',
  planName: 'ONE MORE Pro',
  premiumName: 'ONE MORE Premium',
  coachName: 'ONE MORE Coach',
  taglinePrimary: 'Only One.',
  taglineSecondary: 'Only One.',
  heroHeadline: 'YOUR TRANSFORMATION STARTS WITH ONE MORE.',
} as const;

/** @deprecated */
export const Colors = {
  light: {
    text: LiftFlowColors.textPrimary,
    background: LiftFlowColors.background,
    backgroundElement: LiftFlowColors.surface,
    backgroundSelected: LiftFlowColors.surfaceElevated,
    textSecondary: LiftFlowColors.textSecondary,
  },
  dark: {
    text: LiftFlowColors.textPrimary,
    background: LiftFlowColors.background,
    backgroundElement: LiftFlowColors.surface,
    backgroundSelected: LiftFlowColors.surfaceElevated,
    textSecondary: LiftFlowColors.textSecondary,
  },
} as const;

export type ThemeColor = keyof typeof Colors.dark;

export const BottomTabInset = TabBarHeight;
export const MaxContentWidth = 480;

export const Fonts = Platform.select({
  ios: { sans: 'System', serif: 'Georgia', rounded: 'System', mono: 'Menlo' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: { sans: 'Inter, system-ui', serif: 'Georgia', rounded: 'system-ui', mono: 'monospace' },
});
