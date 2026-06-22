import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { initDatabase } from '../src/db/database';
import { useAppStore } from '../src/store/useAppStore';

export default function RootLayout() {
  const setDbReady = useAppStore((s) => s.setDbReady);
  const refreshCategories = useAppStore((s) => s.refreshCategories);
  const refreshExpenses = useAppStore((s) => s.refreshExpenses);

  useEffect(() => {
    (async () => {
      await initDatabase();
      setDbReady(true);
      await refreshCategories();
      await refreshExpenses();
    })();
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
