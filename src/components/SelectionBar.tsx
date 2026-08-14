import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

interface ActionDef {
  key: string;
  icon: string;
  label: string;
  onPress: () => void;
}

interface Props {
  count: number;
  actions: ActionDef[];
  onClose: () => void;
}

/** Floating action bar shown during multi-select mode. */
export function SelectionBar({ count, actions, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { backgroundColor: theme.colors.card, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
          <Text style={[styles.closeText, { color: theme.colors.textSecondary }]}>× 取消</Text>
        </Pressable>
        <Text style={[styles.count, { color: theme.colors.text }]}>已选 {count} 张</Text>
      </View>

      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable
            key={a.key}
            onPress={a.onPress}
            style={({ pressed }) => [
              styles.action,
              { backgroundColor: theme.colors.inputBackground },
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.actionIcon}>{a.icon}</Text>
            <Text style={[styles.actionLabel, { color: theme.colors.text }]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 10,
    borderRadius: 24,
    paddingTop: 14,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  closeBtn: { paddingVertical: 4 },
  closeText: { fontSize: 15, fontWeight: '700' },
  count: { fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
  },
  actionIcon: { fontSize: 24 },
  actionLabel: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  pressed: { opacity: 0.75 },
});
