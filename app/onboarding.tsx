import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { CLUB_NAME } from '@/constants/club';
import { useAuth } from '@/providers/AuthProvider';

const heroImage = require('../assets/images/crew-image-mc.avif');

export default function OnboardingScreen() {
  const { completeOnboarding } = useAuth();
  const { width } = useWindowDimensions();
  const pressScale = useSharedValue(1);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const getStarted = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await completeOnboarding();
    router.replace('/sign-up');
  };

  return (
    <View style={styles.container}>
      <Image source={heroImage} style={styles.heroImage} contentFit="cover" />
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.16)',
          'rgba(0,0,0,0.08)',
          'rgba(5,5,5,0.28)',
          'rgba(5,5,5,0.92)',
        ]}
        locations={[0, 0.32, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View entering={FadeInUp.duration(520)} style={styles.logoRow}>
          <Text style={styles.logoText}>P</Text>
          <View style={styles.logoPill}>
            <Text style={styles.logoPillText}>MC</Text>
          </View>
        </Animated.View>

        <View style={styles.content}>
          <Animated.View entering={FadeInDown.delay(120).duration(620)} style={styles.copyBlock}>
            <Text style={styles.eyebrow}>{CLUB_NAME}</Text>
            <Text style={[styles.title, width < 380 && styles.titleSmall]}>
              Ride together. Stay connected.
            </Text>
            <Text style={styles.subtitle}>
              A private club app for rides, announcements, photos, members, and road memories.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(260).duration(620)} style={buttonStyle}>
            <Pressable
              style={styles.button}
              onPress={getStarted}
              onPressIn={() => {
                pressScale.value = withSpring(0.97, { damping: 16, stiffness: 240 });
              }}
              onPressOut={() => {
                pressScale.value = withSpring(1, { damping: 16, stiffness: 240 });
              }}
            >
              <LinearGradient
                colors={[Colors.dark.heat, '#FF6A3D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>{"Let's Get Started"}</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  logoRow: {
    alignSelf: 'center',
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoText: {
    color: Colors.dark.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  logoPill: {
    minWidth: 52,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.text,
  },
  logoPillText: {
    color: Colors.dark.background,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  content: {
    paddingHorizontal: 26,
    paddingBottom: 18,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  copyBlock: {
    marginBottom: 34,
  },
  eyebrow: {
    color: Colors.dark.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 43,
    lineHeight: 51,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 16,
  },
  titleSmall: {
    fontSize: 38,
    lineHeight: 45,
  },
  subtitle: {
    color: 'rgba(245,245,245,0.78)',
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 340,
  },
  button: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  buttonGradient: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  buttonText: {
    color: Colors.dark.text,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
  },
});
