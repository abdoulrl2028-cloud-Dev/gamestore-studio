import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

const STORAGE_KEY = 'gamestore.theme';
export type ThemeChoice = 'system' | 'light' | 'dark';

const light: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#4C35C5',
    onPrimary: '#FFFFFF',
    secondary: '#0E8A5B',
    tertiary: '#8A5A00',
    background: '#F4F5FB',
    surface: '#FFFFFF',
    surfaceVariant: '#E7E5F5',
  },
};

const dark: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#C8B6FF',
    onPrimary: '#2B1670',
    secondary: '#7DEbb8',
    tertiary: '#F5C16C',
    background: '#100E18',
    surface: '#1B1730',
    surfaceVariant: '#2A2448',
  },
};

type ThemeContextValue = {
  choice: ThemeChoice;
  isDark: boolean;
  theme: MD3Theme;
  setChoice: (choice: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeController({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === 'light' || value === 'dark' || value === 'system') setChoiceState(value);
      })
      .catch(() => undefined);
  }, []);

  const setChoice = (next: ThemeChoice) => {
    setChoiceState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  };

  const isDark = choice === 'system' ? system !== 'light' : choice === 'dark';
  const value = useMemo(
    () => ({ choice, isDark, theme: isDark ? dark : light, setChoice }),
    [choice, isDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeChoice(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('Tema indisponível.');
  return value;
}
