import React, { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { useStore } from '../state/StoreProvider';
import { getTheme } from './index';
import { ThemeContext } from './ThemeContext';
import { StickerOverlayService } from '../services/stickerOverlayService';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const { settings } = useStore();
  const resolvedScheme = settings.themeMode === 'system' ? scheme : settings.themeMode;
  const theme = useMemo(
    () => getTheme(resolvedScheme, settings.themeColor),
    [resolvedScheme, settings.themeColor],
  );
  useEffect(() => {
    StickerOverlayService.setThemeColor(theme.colors.primary).catch(error => {
      console.warn('[theme] overlay color sync failed', error);
    });
  }, [theme.colors.primary]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export default ThemeProvider;
