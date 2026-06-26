/**
 * Shared design tokens + backward-compatible exports.
 * Runtime theme selection lives in ThemeContext — use useAppTheme() in components.
 */
import {
    BottomTabInset,
    Brand,
    darkClassicTheme,
    FontFamily,
    Fonts,
    MaxContentWidth,
    TabBarHeight,
    TouchTarget,
    Typography,
} from '@/constants/themes';
import { runtimeColors, syncRuntimeTheme } from '@/lib/themeRuntime';

export {
    BottomTabInset, Brand, FontFamily,
    Fonts,
    MaxContentWidth,
    TabBarHeight,
    TouchTarget,
    Typography
};

    export {
        darkClassicTheme,
        defaultThemeId,
        lightProfessionalTheme,
        resolveTheme,
        themeCatalog,
        themeOptions
    } from '@/constants/themes';
    export type { AppTheme, ThemeColorPalette, ThemeId } from '@/constants/themes';

export { syncRuntimeTheme };

/** @deprecated Prefer useAppTheme().colors — synced at runtime when theme changes. */
export const LiftFlowColors = runtimeColors;

/** @deprecated Prefer useAppTheme().brandGradients */
export const BrandGradients = darkClassicTheme.brandGradients;

/** @deprecated Prefer useAppTheme().shadows */
export const Shadows = darkClassicTheme.shadows;

/** @deprecated Prefer useAppTheme().navigationTheme */
export const NavigationTheme = darkClassicTheme.navigationTheme;

/** @deprecated Prefer useAppTheme().radius — use useAppTheme().radius in themed components */
export const Radius = darkClassicTheme.radius;

/** @deprecated Prefer useAppTheme().spacing — use useAppTheme().spacing in themed components */
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
