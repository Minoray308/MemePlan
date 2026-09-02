import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

interface Props {
  title: string;
  location?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Content for the existing modal window; keeps creation above the keyboard. */
export function NameInputForm({ title, location, value, onChange, placeholder = '输入分类名称', confirmLabel = '创建', onCancel, onConfirm }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.overlay, { paddingTop: Math.max(insets.top + 12, Math.min(height * 0.12, 88)) }]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} accessibilityLabel="取消新建" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[styles.card, { backgroundColor: theme.colors.card }]}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          {!!location && <Text numberOfLines={2} style={[styles.location, { color: theme.colors.textSecondary }]}>创建位置：{location}</Text>}
          <TextInput value={value} onChangeText={onChange} autoFocus placeholder={placeholder}
            accessibilityLabel={placeholder} placeholderTextColor={theme.colors.placeholder}
            returnKeyType="done" onSubmitEditing={onConfirm}
            style={[styles.input, { backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]} />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={[styles.button, { backgroundColor: theme.colors.inputBackground }]}>
              <Text style={{ color: theme.colors.textSecondary }}>取消</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={[styles.button, { backgroundColor: theme.colors.primary }]}>
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 24 },
  card: { width: '100%', maxWidth: 360, borderRadius: 20, padding: 20 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 14 },
  location: { fontSize: 13, marginBottom: 12 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  actions: { flexDirection: 'row', marginTop: 16, gap: 10 },
  button: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center' },
});
