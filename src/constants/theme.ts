/**
 * Shared design tokens + backward-compatible exports.
 * Runtime theme selection lives in ThemeContext — use useAppTheme() in components.
 */
import {
  Brand,
  BottomTabInset,
  darkClassicTheme,
  FontFamily,
  Fonts,
  MaxContentWidth,
  TabBarHeight,
  TouchTarget,
  Typography,
} from '@/constants/themes';

export {
  Brand,
  BottomTabInset,
  FontFamily,
  Fonts,
  MaxContentWidth,
  TabBarHeight,
  TouchTarget,
  Typography,
};

export type { AppTheme, ThemeColorPalette, ThemeId } from '@/constants/themes';
export {
  darkClassicTheme,
  defaultThemeId,
  lightProfessionalTheme,
  resolveTheme,
  themeCatalog,
  themeOptions,
} from '@/constants/themes';

/** @deprecated Prefer useAppTheme().colors — defaults to Dark Classic for static imports. */
export const LiftFlowColors = darkClassicTheme.colors;

/** @deprecated Prefer useAppTheme().brandGradients */
export const BrandGradients = darkClassicTheme.brandGradients;

/** @deprecated Prefer useAppTheme().shadows */
export const Shadows = darkClassicTheme.shadows;

/** @deprecated Prefer useAppTheme().navigationTheme */
export const NavigationTheme = darkClassicTheme.navigationTheme;

/** @deprecated Prefer useAppTheme().radius */
export const Radius = darkClassicTheme.radius;

/** @deprecated Prefer useAppTheme().spacing */
export const Spacing = darkClassicTheme.spacing;

export type LiftFlowColor = keyof typeof LiftFlowColors;

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
