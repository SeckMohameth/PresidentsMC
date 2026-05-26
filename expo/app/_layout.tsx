import "@/utils/fatalErrorHandler"; // must be first — intercepts JS fatals before native crash
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { AnalyticsProvider } from "@/providers/AnalyticsProvider";
import { CrewProvider } from "@/providers/CrewProvider";
import { RevenueCatProvider } from "@/providers/RevenueCatProvider";
import Colors, { useThemeColors } from "@/constants/colors";
import "@/utils/firebase";
import PushNotificationManager from "@/components/PushNotificationManager";

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { authStatus } = useAuth();
  const colors = useThemeColors();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const currentSegment = segments[0];

  const inAuthGroup = currentSegment === 'onboarding' ||
                      currentSegment === 'feature-onboarding' ||
                      currentSegment === 'sign-in' ||
                      currentSegment === 'sign-up' ||
                      currentSegment === 'crew-selection' ||
                      currentSegment === 'join-crew' ||
                      currentSegment === 'create-crew-paywall';
  const inAuthFlow =
    currentSegment === 'onboarding' ||
    currentSegment === 'sign-in' ||
    currentSegment === 'sign-up';
  const inFeatureOnboardingFlow = currentSegment === 'feature-onboarding';
  const inNeedsCrewFlow =
    currentSegment === 'crew-selection' ||
    currentSegment === 'join-crew' ||
    currentSegment === 'create-crew-paywall';
  const shouldHoldForRedirect =
    !rootNavigationState?.key ||
    authStatus === 'loading' ||
    (authStatus === 'onboarding' && currentSegment !== 'onboarding') ||
    (authStatus === 'unauthenticated' && !inAuthFlow) ||
    (authStatus === 'feature_onboarding' && !inFeatureOnboardingFlow) ||
    (authStatus === 'needs_crew' && !inNeedsCrewFlow) ||
    (authStatus === 'authenticated' && inAuthGroup);

  useEffect(() => {
    if (authStatus === 'loading' || !rootNavigationState?.key) return;

    if (authStatus === 'onboarding') {
      router.replace('/onboarding');
    } else if (authStatus === 'unauthenticated' && !inAuthFlow) {
      router.replace('/sign-up');
    } else if (authStatus === 'feature_onboarding' && !inFeatureOnboardingFlow) {
      router.replace('/feature-onboarding');
    } else if (authStatus === 'needs_crew' && !inNeedsCrewFlow) {
      router.replace('/crew-selection');
    } else if (authStatus === 'authenticated' && inAuthGroup) {
      router.replace('/');
    }
  }, [
    authStatus,
    inAuthFlow,
    inAuthGroup,
    inFeatureOnboardingFlow,
    inNeedsCrewFlow,
    rootNavigationState?.key,
    router,
  ]);

  if (shouldHoldForRedirect) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="onboarding" 
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="feature-onboarding" 
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="sign-up" 
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="sign-in" 
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="crew-selection" 
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }} 
      />
      <Stack.Screen 
        name="join-crew" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="create-crew-paywall" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="ride/[id]" 
        options={{ 
          headerShown: false,
          presentation: 'card',
        }} 
      />
      <Stack.Screen 
        name="create-ride" 
        options={{ 
          presentation: 'modal',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="create-announcement" 
        options={{ 
          presentation: 'modal',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="create-album" 
        options={{ 
          presentation: 'modal',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="members" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen
        name="member/[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="admin-settings" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="notifications" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="preferences" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="account-security" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="album/[id]" 
        options={{ 
          headerShown: false,
        }} 
      />
    </Stack>
  );
}

export default function RootLayout() {
  const colors = useThemeColors();
  const statusBarStyle = colors.background === Colors.light.background ? 'dark' : 'light';

  return (
    <QueryClientProvider client={queryClient}>
      <RevenueCatProvider>
        <AuthProvider>
          <AnalyticsProvider>
            <CrewProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <StatusBar style={statusBarStyle} />
                <PushNotificationManager />
                <AuthGate>
                  <RootLayoutNav />
                </AuthGate>
              </GestureHandlerRootView>
            </CrewProvider>
          </AnalyticsProvider>
        </AuthProvider>
      </RevenueCatProvider>
    </QueryClientProvider>
  );
}

// Expo Router ErrorBoundary — catches render errors and shows them on screen
// instead of crashing the app. Remove this once the crash is identified and fixed.
export function ErrorBoundary({ error }: { error: Error }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#000', padding: 24, paddingTop: 80, justifyContent: 'flex-start' }}>
      <Text style={{ color: '#ff4444', fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
        Debug: Render Error
      </Text>
      <Text style={{ color: '#fff', fontSize: 13, marginBottom: 8 }}>{error?.message}</Text>
      <Text style={{ color: '#aaa', fontSize: 11 }}>{error?.stack?.substring(0, 1000)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
