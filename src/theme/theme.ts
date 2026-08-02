import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

const shared = {
  accent: '#7558F6',
  accentStrong: '#5C3FE0',
  success: '#2DBE8C',
  warning: '#F4A261',
  danger: '#F06C7A',
  info: '#54A7F7',
  priorityLow: '#54A7F7',
  priorityMedium: '#F4A261',
  priorityHigh: '#F06C7A',
} as const;

export const darkTheme = {
  ...shared,
  dark: true,
  background: '#0B0C12',
  backgroundSecondary: '#10111A',
  surface: '#171822',
  surfaceRaised: '#20212E',
  surfaceElevated: '#292A3A',
  accentSurface: '#272143',
  accentSurfaceStrong: '#332962',
  accentSoft: '#B7ACFF',
  successSurface: '#142C27',
  warningSurface: '#30251A',
  dangerSurface: '#321D24',
  border: '#2B2C3A',
  borderStrong: '#3B3C4F',
  text: '#F8F8FC',
  textSecondary: '#D3D3DE',
  textMuted: '#9697A8',
  input: '#11121A',
  scrim: 'rgba(4, 5, 9, 0.72)',
  shadow: '#000000',
} as const;

export const lightTheme = {
  ...shared,
  dark: false,
  background: '#F6F5FA',
  backgroundSecondary: '#EEEAF7',
  surface: '#FFFFFF',
  surfaceRaised: '#F0EEF7',
  surfaceElevated: '#E8E5F2',
  accentSurface: '#ECE7FF',
  accentSurfaceStrong: '#DDD4FF',
  accentSoft: '#5B42D1',
  successSurface: '#E2F7F0',
  warningSurface: '#FFF0DE',
  dangerSurface: '#FFE5E9',
  border: '#E1DFE9',
  borderStrong: '#CCC8D8',
  text: '#1A1823',
  textSecondary: '#464350',
  textMuted: '#74717F',
  input: '#F8F7FB',
  scrim: 'rgba(24, 20, 34, 0.42)',
  shadow: '#29233A',
} as const;

export type AppTheme = typeof darkTheme | typeof lightTheme;
export type ThemePreference = 'system' | 'light' | 'dark';

export interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  theme: AppTheme;
}

export const AppThemeContext = createContext<ThemeContextValue | null>(null);

export function useAppTheme(): AppTheme {
  const context = useContext(AppThemeContext);
  const colorScheme = useColorScheme();
  return context?.theme ?? (colorScheme === 'light' ? lightTheme : darkTheme);
}

export function useThemePreference(): ThemeContextValue {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error('useThemePreference must be used within ThemeProvider');
  return context;
}
