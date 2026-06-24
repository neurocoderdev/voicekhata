import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { initDatabase } from '../src/db/database';
import { useAppStore } from '../src/store/useAppStore';

export default function RootLayout() {
  const setDbReady = useAppStore((s) => s.setDbReady);
  const refreshAll = useAppStore((s) => s.refreshAll);
  const loadSettings = useAppStore((s) => s.loadSettings);

  useEffect(() => {
    (async () => {
      await initDatabase();
      setDbReady(true);
      // Categories must load before any voice command — the parser's fuzzy
      // matcher reads them from the store.
      await Promise.all([refreshAll(), loadSettings()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <StatusBar style="light" />
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
    </>
  );
}
