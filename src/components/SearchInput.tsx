import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface Props { value: string; onChangeText: (value: string) => void; placeholder: string }

export function SearchInput({ value, onChangeText, placeholder }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: theme.colors.inputBackground }]}>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder}
        accessibilityLabel={placeholder} placeholderTextColor={theme.colors.placeholder}
        autoCorrect={false} autoCapitalize="none" returnKeyType="search"
        style={[styles.input, { color: theme.colors.text }]} />
      {!!value && <Pressable onPress={() => onChangeText('')} accessibilityLabel="清空搜索" hitSlop={8}>
        <Text style={{ color: theme.colors.primary, padding: 8 }}>清空</Text>
      </Pressable>}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { marginHorizontal: 16, marginVertical: 8, paddingLeft: 14, paddingRight: 6, borderRadius: 14, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 15, paddingVertical: 12 },
});
