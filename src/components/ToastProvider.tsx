import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

interface ToastContextValue {
  show: (text: string, type?: ToastType) => void;
  success: (text: string) => void;
  error: (text: string) => void;
  info: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (text: string, type: ToastType = 'info') => {
      const id = ++toastId;
      setToasts((prev) => [...prev.slice(-2), { id, text, type }]);
    },
    [],
  );

  const value = useMemo<ToastContextValue>(() => ({
    show,
    success: (t) => show(t, 'success'),
    error: (t) => show(t, 'error'),
    info: (t) => show(t, 'info'),
  }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View style={[styles.container, { top: '42%' }]} pointerEvents="none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={remove} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: ToastMessage; onDone: (id: number) => void }) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(8)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(translate, { toValue: 0, speed: 20, bounciness: 4, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => onDone(toast.id), 2200);
    return () => clearTimeout(timer);
  }, [onDone, opacity, translate, toast.id]);

  const bg =
    toast.type === 'success' ? theme.colors.primary : toast.type === 'error' ? theme.colors.danger : '#2B2F38';

  return (
    <Animated.View style={[styles.item, { opacity, transform: [{ translateY: translate }] }]}>
      <View style={[styles.pill, { backgroundColor: bg }]}>
        <Text style={styles.text}>{toast.text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  item: { marginBottom: 8 },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    maxWidth: 320,
  },
  text: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' },
});

