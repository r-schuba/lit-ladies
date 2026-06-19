import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import '../global.css';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="book/[id]" options={{ title: 'Book Details', headerBackTitle: 'Back' }} />
      <Stack.Screen name="meeting/new" options={{ headerShown: false }} />
      <Stack.Screen name="members" options={{ headerShown: false }} />
      <Stack.Screen name="member/[id]" options={{ title: 'Member Profile', headerBackTitle: 'Members' }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
