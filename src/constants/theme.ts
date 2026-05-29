import { Platform } from 'react-native';

/** LiftFlow dark premium palette — Apple Fitness / Whoop inspired */
export const LiftFlowColors = {
  background: '#0A0A0B',
  backgroundElevated: '#141416',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  surfaceHighlight: '#3A3A3C',
  border: '#2E2E32',
  borderSubtle: '#232326',

  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#636366',
  textMuted: '#48484A',

  accent: '#30D158',
  accentMuted: '#248A3D',
  accentGlow: 'rgba(48, 209, 88, 0.18)',

  restTimer: '#64D2FF',
  restTimerMuted: 'rgba(100, 210, 255, 0.15)',

  warning: '#FF9F0A',
  error: '#FF453A',
  success: '#30D158',

  microphoneRing: '#30D158',
  microphoneFill: '#1C1C1E',
  microphoneGlow: 'rgba(48, 209, 88, 0.35)',

  tabBar: '#0A0A0B',
  tabBarBorder: '#1C1C1E',
  tabInactive: '#636366',
  tabActive: '#30D158',

  overlay: 'rgba(0, 0, 0, 0.72)',
} as const;

export type LiftFlowColor = keyof typeof LiftFlowColors;

export const Typography = {
  hero: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: 0.2 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  headline: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' as const },
  bodyBold: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  callout: { fontSize: 16, lineHeight: 22, fontWeight: '500' as const },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '500' as const },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  metric: { fontSize: 40, lineHeight: 44, fontWeight: '700' as const, letterSpacing: -0.5 },
  timer: { fontSize: 48, lineHeight: 52, fontWeight: '300' as const, letterSpacing: -1 },
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
  /** @deprecated Legacy template aliases */
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** Minimum gym-friendly touch target */
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

export const TabBarHeight = Platform.select({ ios: 84, android: 72, default: 72 }) ?? 72;

export const NavigationTheme = {
  dark: true,
  colors: {
    primary: LiftFlowColors.accent,
    background: LiftFlowColors.background,
    card: LiftFlowColors.surface,
    text: LiftFlowColors.textPrimary,
    border: LiftFlowColors.border,
    notification: LiftFlowColors.accent,
  },
} as const;

/** @deprecated Use LiftFlowColors — kept for legacy template components during migration */
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
