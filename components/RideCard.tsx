import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MapPin, Clock, Users, ChevronRight, Gauge, Navigation } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { Ride } from '@/types';
import { formatDateTime, formatMiles, getPaceColor, getPaceLabel, getDaysUntil, isToday } from '@/utils/helpers';

interface RideCardProps {
  ride: Ride;
  variant?: 'default' | 'compact';
}

export default function RideCard({ ride, variant = 'default' }: RideCardProps) {
  const router = useRouter();
  const daysUntil = getDaysUntil(ride.dateTime);
  const isRideToday = isToday(ride.dateTime);
  const startLabel = ride.startLocation?.name || ride.startLocation?.address || 'Start';
  const endLabel = ride.endLocation?.name || ride.endLocation?.address || 'End';
  const isPastDue = ride.status === 'upcoming' && daysUntil < 0;
  const statusTone =
    ride.status === 'completed'
      ? Colors.dark.completed
      : ride.status === 'cancelled'
        ? Colors.dark.cancelled
        : isRideToday
          ? Colors.dark.heat
          : isPastDue
            ? Colors.dark.pending
            : Colors.dark.upcoming;
  const statusLabel =
    ride.status === 'completed'
      ? 'Completed'
      : ride.status === 'cancelled'
        ? 'Cancelled'
        : isPastDue
          ? 'Past due'
          : isRideToday
            ? 'Today'
            : daysUntil === 1
              ? 'Tomorrow'
              : `In ${daysUntil} days`;

  const handlePress = () => {
    router.push(`/ride/${ride.id}`);
  };

  if (variant === 'compact') {
    return (
      <Pressable 
        style={({ pressed }) => [styles.compactContainer, pressed && styles.pressed]}
        onPress={handlePress}
      >
        <Image 
          source={{ uri: ride.coverImage }} 
          style={styles.compactImage}
          contentFit="cover"
        />
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle} numberOfLines={1}>{ride.title}</Text>
          <Text style={styles.compactDate}>{formatDateTime(ride.dateTime)}</Text>
          <View style={styles.compactStats}>
            <View style={styles.compactStat}>
              <MapPin size={12} color={Colors.dark.textTertiary} />
              <Text style={styles.compactStatText}>{formatMiles(ride.estimatedDistance)} mi</Text>
            </View>
            <View style={styles.compactStat}>
              <Users size={12} color={Colors.dark.textTertiary} />
              <Text style={styles.compactStatText}>{ride.attendees.length}</Text>
            </View>
          </View>
        </View>
        <ChevronRight size={20} color={Colors.dark.textTertiary} />
      </Pressable>
    );
  }

  return (
    <Pressable 
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
    >
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: ride.coverImage }} 
          style={styles.image}
          contentFit="cover"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.24)', 'rgba(0,0,0,0.92)']}
          style={styles.gradient}
        />
        <LinearGradient
          colors={['transparent', 'rgba(216,58,46,0.78)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heatLine}
        />
        {(ride.status === 'upcoming' || ride.status === 'completed' || ride.status === 'cancelled') && (
          <View style={[styles.statusBadge, { borderColor: statusTone }]}>
            <Text style={[styles.statusText, { color: statusTone }]}>
              {statusLabel}
            </Text>
          </View>
        )}
        <View style={styles.imageOverlay}>
          <View style={styles.routePill}>
            <Navigation size={12} color={Colors.dark.primary} />
            <Text style={styles.routePillText}>{formatMiles(ride.estimatedDistance)} mi</Text>
          </View>
          <Text style={styles.title}>{ride.title}</Text>
          <Text style={styles.date}>{formatDateTime(ride.dateTime)}</Text>
        </View>
      </View>
      <View style={styles.content}>
        <View style={styles.locationRow}>
          <MapPin size={14} color={Colors.dark.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {startLabel} → {endLabel}
          </Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Clock size={14} color={Colors.dark.textTertiary} />
            <Text style={styles.statText}>{ride.estimatedDuration}</Text>
          </View>
          <View style={styles.stat}>
            <MapPin size={14} color={Colors.dark.textTertiary} />
            <Text style={styles.statText}>{formatMiles(ride.estimatedDistance)} mi</Text>
          </View>
          <View style={styles.stat}>
            <Gauge size={14} color={getPaceColor(ride.pace)} />
            <Text style={[styles.statText, { color: getPaceColor(ride.pace) }]}>
              {getPaceLabel(ride.pace)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Users size={14} color={Colors.dark.textTertiary} />
            <Text style={styles.statText}>{ride.attendees.length} going</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(18,18,19,0.92)',
    borderRadius: 22,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(229,229,229,0.12)',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
    shadowColor: Colors.dark.heat,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  imageContainer: {
    height: 210,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    height: '100%',
  },
  heatLine: {
    position: 'absolute',
    left: -30,
    right: -20,
    bottom: -24,
    height: 95,
    transform: [{ rotate: '-8deg' }],
    opacity: 0.8,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(10,10,10,0.72)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(229,229,229,0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  routePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(229,229,229,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  routePillText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  date: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229,229,229,0.08)',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  locationText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  compactContainer: {
    backgroundColor: 'rgba(17,17,17,0.92)',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229,229,229,0.12)',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
  },
  compactImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceElevated,
  },
  compactContent: {
    flex: 1,
    marginLeft: 12,
  },
  compactTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  compactDate: {
    color: Colors.dark.textTertiary,
    fontSize: 13,
    marginBottom: 4,
  },
  compactStats: {
    flexDirection: 'row',
    gap: 12,
  },
  compactStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactStatText: {
    color: Colors.dark.textTertiary,
    fontSize: 12,
  },
});
