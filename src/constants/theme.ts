import { Platform } from 'react-native';

/** ONE MORE — light performance brand system */
export const LiftFlowColors = {
  background: '#F0F3F8',
  backgroundSecondary: '#FFFFFF',
  backgroundElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceHighlight: '#E8EDF4',
  border: 'rgba(15, 23, 42, 0.09)',
  borderSubtle: 'rgba(15, 23, 42, 0.05)',

  textPrimary: '#0F172A',
  textSecondary: '#5B6577',
  textTertiary: '#8B95A8',
  textMuted: '#B8C0CC',

  primary: '#0E90FF',
  primaryMuted: '#0B73CC',
  primaryGlow: 'rgba(14, 144, 255, 0.1)',

  accent: '#0E90FF',
  accentMuted: '#0B73CC',
  accentGlow: 'rgba(14, 144, 255, 0.08)',

  legacyAccent: '#1F6BFF',

  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',

  restTimer: '#0891B2',
  restTimerMuted: 'rgba(8, 145, 178, 0.1)',

  gradientStart: '#0E90FF',
  gradientEnd: '#38BDF8',

  glass: 'rgba(255, 255, 255, 0.88)',
  overlay: 'rgba(15, 23, 42, 0.5)',

  microphoneRing: '#0E90FF',
  microphoneFill: '#FFFFFF',
  microphoneGlow: 'rgba(14, 144, 255, 0.2)',

  tabBar: '#FFFFFF',
  tabBarBorder: 'rgba(15, 23, 42, 0.07)',
  tabInactive: '#8B95A8',
  tabActive: '#0E90FF',

  /** Text on top of hero photography */
  onPhoto: '#FFFFFF',
  onPhotoMuted: 'rgba(255, 255, 255, 0.82)',
} as const;

export const BrandGradients = {
  border: {
    default: ['rgba(14, 144, 255, 0.45)', 'rgba(56, 189, 248, 0.2)'] as const,
    subtle: ['rgba(14, 144, 255, 0.28)', 'rgba(14, 144, 255, 0.08)'] as const,
    bold: ['rgba(14, 144, 255, 0.55)', 'rgba(56, 189, 248, 0.25)'] as const,
  },
  button: [LiftFlowColors.primary, LiftFlowColors.primaryMuted] as const,
  insightFill: ['rgba(14, 144, 255, 0.06)', '#FFFFFF'] as const,
  photoOverlay: ['transparent', 'rgba(15, 23, 42, 0.72)'] as const,
} as const;

export type LiftFlowColor = keyof typeof LiftFlowColors;

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

export const Typography = {
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  glow: {
    shadowColor: LiftFlowColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  tabBar: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

export const TabBarHeight = Platform.select({ ios: 84, android: 72, default: 72 }) ?? 72;

export const NavigationTheme = {
  dark: false,
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
