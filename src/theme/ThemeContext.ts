import { createContext } from 'react';
import { getTheme } from './index';

/** Non-null default so `useTheme` fails loudly when provider is missing. */
export const ThemeContext = createContext(getTheme('light'));
