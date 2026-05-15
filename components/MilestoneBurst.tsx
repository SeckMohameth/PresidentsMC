import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Award, Camera, MapPin, Route } from 'lucide-react-native';
import Colors from '@/constants/colors';

type Milestone = {
  id: string;
  label: string;
  value: string;
  tone: string;
  icon: 'rides' | 'miles' | 'photos' | 'award';
};

interface MilestoneBurstProps {
  milestones: Milestone[];
}

const icons = {
  rides: Route,
  miles: MapPin,
  photos: Camera,
  award: Award,
};

export default function MilestoneBurst({ milestones }: MilestoneBurstProps) {
  const glow = useSharedValue(0.35);

  React.useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 }),
        withTiming(0.35, { duration: 1200 })
      ),
      -1,
      true
    );
  }, [glow]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.98 + glow.value * 0.04 }],
  }));

  if (milestones.length === 0) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(420)}
      exiting={FadeOutUp.duration(220)}
      layout={Layout.springify().damping(18)}
      style={styles.container}
    >
      <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>Milestones</Text>
        <Text style={styles.count}>{milestones.length} unlocked</Text>
      </View>
      <View style={styles.badgeGrid}>
        {milestones.map((milestone, index) => {
          const Icon = icons[milestone.icon];
          return (
            <Animated.View
              key={milestone.id}
              entering={FadeInDown.delay(index * 90).springify().damping(16)}
              layout={Layout.springify().damping(16)}
              style={styles.badge}
            >
              <View style={[styles.iconWrap, { borderColor: milestone.tone }]}>
                <Icon size={18} color={milestone.tone} />
              </View>
              <View style={styles.badgeTextWrap}>
                <Text style={styles.badgeValue}>{milestone.value}</Text>
                <Text style={styles.badgeLabel}>{milestone.label}</Text>
              </View>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.dark.borderLight,
    backgroundColor: Colors.dark.surface,
    padding: 14,
    marginBottom: 18,
  },
  glow: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: -18,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.dark.heatMuted,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kicker: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  count: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  badgeGrid: {
    gap: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  badgeTextWrap: {
    flex: 1,
  },
  badgeValue: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '800',
  },
  badgeLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
