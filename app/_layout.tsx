import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { AnalyticsProvider } from "@/providers/AnalyticsProvider";
import { CrewProvider } from "@/providers/CrewProvider";
import { RevenueCatProvider } from "@/providers/RevenueCatProvider";
import Colors from "@/constants/colors";
import "@/utils/firebase";
import PushNotificationManager from "@/components/PushNotificationManager";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { authStatus } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (authStatus === 'loading' || !rootNavigationState?.key) return;

    const inAuthGroup = segments[0] === 'onboarding' || 
                        segments[0] === 'feature-onboarding' ||
                        segments[0] === 'sign-in' || 
                        segments[0] === 'sign-up' ||
                        segments[0] === 'crew-selection' ||
                        segments[0] === 'join-crew' ||
                        segments[0] === 'create-crew-paywall';
    const inAuthFlow =
      segments[0] === 'onboarding' ||
      segments[0] === 'sign-in' ||
      segments[0] === 'sign-up';
    const inFeatureOnboardingFlow = segments[0] === 'feature-onboarding';
    const inNeedsCrewFlow =
      segments[0] === 'crew-selection' ||
      segments[0] === 'join-crew' ||
      segments[0] === 'create-crew-paywall';

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
  }, [authStatus, rootNavigationState?.key, segments, router]);

  if (authStatus === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: Colors.dark.background },
        headerTintColor: Colors.dark.text,
        contentStyle: { backgroundColor: Colors.dark.background },
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
        name="members" 
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
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RevenueCatProvider>
        <AuthProvider>
          <AnalyticsProvider>
            <CrewProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <StatusBar style="light" />
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
