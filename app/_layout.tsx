import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { DATABASE_NAME, migrateDatabase } from '@/data/database';
import { DataVersionProvider } from '@/providers/data-version-provider';
import { LanguageProvider } from '@/providers/language-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { useAppTheme } from '@/theme/theme';

function AppNavigation() {
  const theme = useAppTheme();
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }} />
    </>
  );
}

function LoadingDatabase() {
  const theme = useAppTheme();
  return (
    <View style={[styles.loading, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.accent} size="large" />
      <Text style={[styles.loadingText, { color: theme.textMuted }]}>Preparando TaskOrg…</Text>
    </View>
  );
}

class StartupErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TaskOrg] Startup error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.errorScreen}>
          <Text style={styles.errorTitle}>No se pudo iniciar TaskOrg</Text>
          <Text style={styles.errorText}>{this.state.error.message}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <StartupErrorBoundary>
          <Suspense fallback={<LoadingDatabase />}>
            <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase} useSuspense>
              <DataVersionProvider>
                <AppNavigation />
              </DataVersionProvider>
            </SQLiteProvider>
          </Suspense>
        </StartupErrorBoundary>
      </LanguageProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 15, marginTop: 14 },
  errorScreen: {
    flex: 1,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: { color: '#F9FAFB', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  errorText: { color: '#FCA5A5', fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
