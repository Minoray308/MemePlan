import React, { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useStore } from '../state/StoreProvider';
import { getTheme } from './index';
import { ThemeContext } from './ThemeContext';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const { settings } = useStore();
  const resolvedScheme = settings.themeMode === 'system' ? scheme : settings.themeMode;
  const theme = useMemo(
    () => getTheme(resolvedScheme, settings.themeColor),
    [resolvedScheme, settings.themeColor],
  );
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
