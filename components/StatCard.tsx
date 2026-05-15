import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import Animated, {
  FadeInUp,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Colors from '@/constants/colors';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export default function StatCard({ icon: Icon, label, value, subtitle, color = Colors.dark.primary }: StatCardProps) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withSequence(
      withTiming(1.03, { duration: 120 }),
      withSpring(1, { damping: 14, stiffness: 180 })
    );
  }, [pulse, value]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.duration(360)}
      layout={Layout.springify().damping(18)}
      style={[styles.container, animatedStyle]}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
        <Icon size={22} color={color} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    minWidth: 100,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  value: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  label: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.dark.textTertiary,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
});
