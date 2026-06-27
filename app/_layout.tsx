import { useCallback, useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from '../src/db/database';
import { useAppStore } from '../src/store/useAppStore';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { LoadingGate, DbErrorGate } from '../src/components/AppGate';

type DbPhase = 'loading' | 'ready' | 'error';

export default function RootLayout() {
  const setDbReady = useAppStore((s) => s.setDbReady);
  const setDbRecovered = useAppStore((s) => s.setDbRecovered);
  const refreshAll = useAppStore((s) => s.refreshAll);
  const loadSettings = useAppStore((s) => s.loadSettings);

  const [dbPhase, setDbPhase] = useState<DbPhase>('loading');

  const boot = useCallback(async () => {
    setDbPhase('loading');
    try {
      const { recovered } = await initDatabase();
      setDbRecovered(recovered);
      setDbReady(true);
      // Categories must load before any voice command — the parser's fuzzy
      // matcher reads them from the store.
      await Promise.all([refreshAll(), loadSettings()]);
      setDbPhase('ready');
    } catch (e) {
      // initDatabase already tried a rebuild; reaching here means storage is
      // genuinely unusable. Show a retry gate rather than a frozen splash.
      console.warn('[RootLayout] database boot failed:', e);
      setDbReady(false);
      setDbPhase('error');
    }
  }, [setDbReady, setDbRecovered, refreshAll, loadSettings]);

  useEffect(() => {
    boot();
  }, [boot]);

  if (dbPhase === 'error') {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <DbErrorGate onRetry={boot} />
      </SafeAreaProvider>
    );
  }

  if (dbPhase === 'loading') {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <LoadingGate />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary>
        <Tabs
          screenOptions={{
            headerStyle: { backgroundColor: '#1a1a2e' },
            headerTintColor: '#e0e0e0',
            headerTitleStyle: { fontWeight: 'bold' },
            tabBarStyle: { backgroundColor: '#1a1a2e', borderTopColor: '#2a2a4e' },
            tabBarActiveTintColor: '#7c83fd',
            tabBarInactiveTintColor: '#60607a',
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'VoiceKhata',
              tabBarLabel: 'Home',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🎙</Text>,
            }}
          />
          <Tabs.Screen
            name="history"
            options={{
              title: 'History',
              tabBarLabel: 'History',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📋</Text>,
            }}
          />
          <Tabs.Screen
            name="categories"
            options={{
              title: 'Categories',
              tabBarLabel: 'Categories',
              tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🏷</Text>,
            }}
          />
        </Tabs>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
