import React, { useRef, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, ViewToken } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { Bell, Camera, Map, Shield, Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { CLUB_NAME } from '@/constants/club';
import { useAuth } from '@/providers/AuthProvider';

const heroImage = require('../assets/images/crew-image-mc.avif');

type FeatureSlide = {
  id: string;
  label: string;
  title: string;
  body: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  bullets: string[];
};

const slides: FeatureSlide[] = [
  {
    id: 'rides',
    label: 'Rides',
    title: 'Plan the route before anyone rolls out.',
    body: 'Admins can create rides with start and end points. Members can join, check details, and open directions.',
    icon: Map,
    bullets: ['Start and end locations', 'Apple or Google Maps directions', 'RSVPs and check-ins'],
  },
  {
    id: 'announcements',
    label: 'Updates',
    title: 'Keep club business out of noisy feeds.',
    body: 'Announcements are private to approved members, with pinned posts for the things everyone needs to see.',
    icon: Bell,
    bullets: ['Pinned club updates', 'Optional images and links', 'Admin and officer controls'],
  },
  {
    id: 'albums',
    label: 'Albums',
    title: 'Every completed ride gets a memory lane.',
    body: 'Members can add ride photos after a ride, and the club can look back through shared albums and stats.',
    icon: Camera,
    bullets: ['Shared ride albums', 'Member profile photos', 'Club mileage and photo stats'],
  },
  {
    id: 'private',
    label: 'Private',
    title: 'Built for one club, not the whole internet.',
    body: 'Members request access first. Admins approve who gets in and can manage roles as the club grows.',
    icon: Shield,
    bullets: ['Invite and approval flow', 'Admin, officer, member roles', 'Private Firestore and Storage rules'],
  },
];

export default function FeatureOnboardingScreen() {
  const { completeFeatureOnboarding } = useAuth();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<FeatureSlide>>(null);
  const [index, setIndex] = useState(0);

  const complete = async () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    await completeFeatureOnboarding();
    router.replace('/crew-selection');
  };

  const next = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (index < slides.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1 });
      return;
    }
    void complete();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const renderSlide = ({ item, index: slideIndex }: { item: FeatureSlide; index: number }) => {
    const Icon = item.icon;
    return (
      <View style={[styles.slide, { width }]}>
        <Animated.View entering={FadeInDown.delay(80).duration(420)} style={styles.featurePanel}>
          <View style={styles.panelTopRow}>
            <View style={styles.iconBox}>
              <Icon size={25} color={Colors.dark.text} strokeWidth={1.8} />
            </View>
            <Text style={styles.slideCount}>{slideIndex + 1}/{slides.length}</Text>
          </View>
          <Text style={styles.slideLabel}>{item.label}</Text>
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={styles.slideBody}>{item.body}</Text>
          <View style={styles.bulletList}>
            {item.bullets.map((bullet, bulletIndex) => (
              <Animated.View
                key={bullet}
                entering={FadeInDown.delay(140 + bulletIndex * 70).duration(320)}
                layout={Layout.springify().damping(18)}
                style={styles.bulletRow}
              >
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{bullet}</Text>
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.imageHeader}>
        <Image source={heroImage} style={styles.heroImage} contentFit="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0.08)', 'rgba(5,5,5,0.34)', Colors.dark.background]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <Animated.View entering={FadeInUp.duration(420)} style={styles.header}>
          <View style={styles.clubMark}>
            <Users size={18} color={Colors.dark.background} strokeWidth={2.2} />
          </View>
          <View>
            <Text style={styles.kicker}>Welcome to</Text>
            <Text style={styles.clubName}>{CLUB_NAME}</Text>
          </View>
        </Animated.View>

        <FlatList
          ref={listRef}
          data={slides}
          keyExtractor={(item) => item.id}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 60 }}
        />

        <View style={styles.footer}>
          <View style={styles.dots}>
            {slides.map((slide, dotIndex) => (
              <View
                key={slide.id}
                style={[styles.dot, dotIndex === index && styles.dotActive]}
              />
            ))}
          </View>
          <Pressable style={styles.button} onPress={next}>
            <Text style={styles.buttonText}>
              {index === slides.length - 1 ? 'Enter PresidentsMC' : 'Continue'}
            </Text>
          </Pressable>
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
  imageHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 6,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  clubMark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.primary,
  },
  kicker: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  clubName: {
    color: Colors.dark.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0,
  },
  slide: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  featurePanel: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.borderLight,
    backgroundColor: 'rgba(17,17,17,0.94)',
    padding: 18,
  },
  panelTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.heat,
  },
  slideCount: {
    color: Colors.dark.textTertiary,
    fontSize: 13,
    fontWeight: '700',
  },
  slideLabel: {
    color: Colors.dark.primary,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 8,
  },
  slideTitle: {
    color: Colors.dark.text,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 12,
  },
  slideBody: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  bulletList: {
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 24,
  },
  bulletDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.dark.heat,
  },
  bulletText: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 22,
    paddingBottom: 16,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 7,
    marginBottom: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.borderLight,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.dark.primary,
  },
  button: {
    minHeight: 56,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.text,
  },
  buttonText: {
    color: Colors.dark.background,
    fontSize: 16,
    fontWeight: '900',
  },
});
