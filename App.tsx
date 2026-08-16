import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme/ThemeProvider';
import { StoreProvider } from './src/state/StoreProvider';
import { ToastProvider } from './src/components/ToastProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { StickerOverlayService } from './src/services/stickerOverlayService';
import { UpdateProvider } from './src/components/update/UpdateProvider';
import { useTheme } from './src/hooks/useTheme';

function AppInner() {
  const theme = useTheme();

  // Remove temporary quick-send gallery images left over from a previous
  // session (e.g. the app was killed before the user confirmed "已发送").
  useEffect(() => {
    StickerOverlayService.cleanupOrphanedTemps().catch(() => {});
  }, []);

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <ThemeProvider>
          <ToastProvider>
            <UpdateProvider>
              <AppInner />
            </UpdateProvider>
          </ToastProvider>
        </ThemeProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

