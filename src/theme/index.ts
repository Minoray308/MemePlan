import type { ColorSchemeName } from 'react-native';

export interface ThemeColors {
  background: string;
  card: string;
  cardBorder: string;
  primary: string;
  primarySoft: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  divider: string;
  danger: string;
  favorite: string;
  overlay: string;
  tabBar: string;
  inputBackground: string;
  placeholder: string;
  skeleton: string;
}

export interface AppTheme {
  dark: boolean;
  colors: ThemeColors;
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    pill: number;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  font: {
    title: number;
    subtitle: number;
    large: number;
    body: number;
    small: number;
    caption: number;
  };
}

export const DEFAULT_THEME_COLOR = '#2F7048';

export const THEME_COLOR_PRESETS = [
  { name: '护眼绿', color: '#2F7048' },
  { name: '天空蓝', color: '#3E6FA8' },
  { name: '暖阳橙', color: '#B66A0A' },
  { name: '珊瑚粉', color: '#B84A5F' },
  { name: '淡雅紫', color: '#6D45C7' },
];

const light: ThemeColors = {
  background: '#E2E5E8',
  card: '#FFFFFF',
  cardBorder: 'rgba(0,0,0,0.06)',
  primary: DEFAULT_THEME_COLOR,
  primarySoft: '#E5F3E9',
  text: '#1B1F27',
  textSecondary: '#5B6270',
  textMuted: '#9AA0AC',
  divider: 'rgba(0,0,0,0.08)',
  danger: '#F2555A',
  favorite: '#FFB13B',
  overlay: 'rgba(0,0,0,0.5)',
  tabBar: DEFAULT_THEME_COLOR,
  inputBackground: '#EEF0F4',
  placeholder: '#B3B9C4',
  skeleton: '#E4E7EC',
};

const dark: ThemeColors = {
  background: '#050608',
  card: '#1C1F26',
  cardBorder: 'rgba(255,255,255,0.08)',
  primary: DEFAULT_THEME_COLOR,
  primarySoft: '#243A2E',
  text: '#F2F3F5',
  textSecondary: '#B8BEC9',
  textMuted: '#7C828F',
  divider: 'rgba(255,255,255,0.1)',
  danger: '#FF6B6F',
  favorite: '#FFC257',
  overlay: 'rgba(0,0,0,0.6)',
  tabBar: DEFAULT_THEME_COLOR,
  inputBackground: '#262A33',
  placeholder: '#5E6470',
  skeleton: '#23262D',
};

function build(colors: ThemeColors, darkMode: boolean): AppTheme {
  return {
    dark: darkMode,
    colors,
    radius: { sm: 8, md: 14, lg: 18, xl: 24, pill: 999 },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    font: { title: 22, subtitle: 16, large: 34, body: 15, small: 13, caption: 11 },
  };
}

export function getTheme(scheme: ColorSchemeName, accent: string = DEFAULT_THEME_COLOR): AppTheme {
  const safeAccent = /^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : DEFAULT_THEME_COLOR;
  const darkMode = scheme === 'dark';
  const base = darkMode ? dark : light;
  const colors: ThemeColors = {
    ...base,
    primary: safeAccent,
    primarySoft: `${safeAccent}${darkMode ? '2E' : '1F'}`,
    tabBar: safeAccent,
  };
  return build(colors, darkMode);
}


