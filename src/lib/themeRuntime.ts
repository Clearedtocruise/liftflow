import type { AppTheme, ThemeColorPalette } from '@/constants/themes';
import { darkClassicTheme } from '@/constants/themes';

/** Mutable legacy palette — synced when the active theme changes. */
export const runtimeColors: ThemeColorPalette = { ...darkClassicTheme.colors };

let activeTheme: AppTheme = darkClassicTheme;

export function getRuntimeTheme(): AppTheme {
  return activeTheme;
}

/** Keeps deprecated `LiftFlowColors` imports in sync for runtime color reads. */
export function syncRuntimeTheme(theme: AppTheme) {
  activeTheme = theme;
  Object.assign(runtimeColors, theme.colors);
}
