import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { AppThemeContext, darkTheme, lightTheme, type ThemePreference } from '@/theme/theme';

const STORAGE_KEY = 'taskorg.theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    Storage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'system' || stored === 'light' || stored === 'dark') setPreferenceState(stored);
    }).catch(() => undefined);
  }, []);

  const value = useMemo(() => {
    const resolvedScheme = preference === 'system' ? systemScheme : preference;
    return {
      preference,
      setPreference(nextPreference: ThemePreference) {
        setPreferenceState(nextPreference);
        void Storage.setItem(STORAGE_KEY, nextPreference).catch(() => undefined);
      },
      theme: resolvedScheme === 'light' ? lightTheme : darkTheme,
    };
  }, [preference, systemScheme]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}
