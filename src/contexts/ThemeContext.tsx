import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  darkClassicTheme,
  defaultThemeId,
  resolveTheme,
  type AppTheme,
  type ThemeId,
} from '@/constants/themes';
import { loadAppearanceThemeId, saveAppearanceThemeId } from '@/lib/appearancePreferences';

type ThemeContextValue = {
  theme: AppTheme;
  themeId: ThemeId;
  isReady: boolean;
  setThemeId: (id: ThemeId) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkClassicTheme,
  themeId: defaultThemeId,
  isReady: false,
  setThemeId: async () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(defaultThemeId);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    void loadAppearanceThemeId().then((stored) => {
      if (!mounted) return;
      setThemeIdState(stored);
      setIsReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setThemeId = useCallback(async (id: ThemeId) => {
    setThemeIdState(id);
    await saveAppearanceThemeId(id);
  }, []);

  const theme = useMemo(() => resolveTheme(themeId), [themeId]);

  const value = useMemo(
    () => ({
      theme,
      themeId,
      isReady,
      setThemeId,
    }),
    [theme, themeId, isReady, setThemeId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  return useContext(ThemeContext).theme;
}

export function useThemeId(): ThemeId {
  return useContext(ThemeContext).themeId;
}

export function useThemeControl() {
  const { themeId, setThemeId, isReady } = useContext(ThemeContext);
  return { themeId, setThemeId, isReady };
}
