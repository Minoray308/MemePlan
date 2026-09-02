import { Text } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { useTheme } from '../hooks/useTheme';

export type AppIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface IconProps {
  name: AppIconName;
  size?: number;
  color?: string;
}

/**
 * Minimalist single-color icon used across the app. Icons are monochrome
 * vector glyphs tinted with the active theme color (defaults to text color).
 */
export function Icon({ name, size = 20, color }: IconProps) {
  const theme = useTheme();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? theme.colors.text} />;
}

interface CategoryIconProps {
  icon?: string | null;
  size?: number;
  color?: string;
}

/**
 * Renders a category icon. Categories store either a monochrome vector icon
 * name (new categories) or a legacy emoji (old data); this handles both.
 */
export function CategoryIcon({ icon, size = 18, color }: CategoryIconProps) {
  const theme = useTheme();
  const glyph = icon ?? '';
  const isVector =
    glyph.length > 0 && (MaterialCommunityIcons as unknown as { glyphMap?: Record<string, number> }).glyphMap?.[glyph] != null;
  if (isVector) {
    return (
      <MaterialCommunityIcons
        name={glyph as AppIconName}
        size={size}
        color={color ?? theme.colors.textSecondary}
      />
    );
  }
  return <Text style={{ fontSize: Math.round(size * 0.85), lineHeight: size }}>{glyph || '📁'}</Text>;
}

export default Icon;
