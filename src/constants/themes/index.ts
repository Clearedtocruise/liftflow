import { darkClassicTheme } from './darkClassic';
import { lightProfessionalTheme } from './lightProfessional';
import type { AppTheme, ThemeId } from './types';

export { darkClassicTheme } from './darkClassic';
export { lightProfessionalTheme } from './lightProfessional';
export * from './shared';
export * from './types';

export const themeCatalog: Record<ThemeId, AppTheme> = {
  'dark-classic': darkClassicTheme,
  'light-professional': lightProfessionalTheme,
};

export const themeOptions: { id: ThemeId; label: string; description: string }[] = [
  {
    id: 'dark-classic',
    label: 'Dark Classic',
    description: 'Original ONE MORE dark performance look',
  },
  {
    id: 'light-professional',
    label: 'Light Professional',
    description: 'Clean white cards, soft blue accents, premium spacing',
  },
];

export const defaultThemeId: ThemeId = 'dark-classic';

export function resolveTheme(id: ThemeId): AppTheme {
  return themeCatalog[id] ?? darkClassicTheme;
}
