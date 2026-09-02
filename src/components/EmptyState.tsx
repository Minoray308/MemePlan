import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Icon, type AppIconName } from './Icon';

interface Props {
  icon?: AppIconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'image-multiple-outline', title, message, actionLabel, onAction }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft }]}>
        <Icon name={icon} size={38} color={theme.colors.primary} />
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      {!!message && (
        <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{message}</Text>
      )}
      {!!actionLabel && !!onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.colors.primary },
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingVertical: 80,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  button: {
    marginTop: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
