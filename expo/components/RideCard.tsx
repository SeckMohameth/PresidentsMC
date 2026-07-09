import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MapPin, Clock, Users, ChevronRight, Gauge, Navigation } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors, useThemeColors } from '@/constants/colors';
import { getCoverImageSource, getDefaultRideCoverUri } from '@/constants/coverImages';
import { useCrew } from '@/providers/CrewProvider';
import { getAvatarSource } from '@/utils/avatar';
import { Ride } from '@/types';
import { formatDateTime, formatMiles, getPaceColor, getPaceLabel, getDaysUntil, isToday, getInitials } from '@/utils/helpers';

interface RideCardProps {
  ride: Ride;
  variant?: 'default' | 'compact';
}

export default function RideCard({ ride, variant = 'default' }: RideCardProps) {
  const colors = useThemeColors();
  const isLight = colors.background === '#FFFFFF';
  const styles = React.useMemo(() => createStyles(colors, isLight), [colors, isLight]);
  const [imageFailed, setImageFailed] = React.useState(false);
  const router = useRouter();
  const { members } = useCrew();
  const attendeePreview = React.useMemo(
    () => members.filter((member) => ride.attendees.includes(member.id)).slice(0, 3),
    [members, ride.attendees]
  );
  const coverImage = !imageFailed && ride.coverImage ? ride.coverImage : getDefaultRideCoverUri();
  const daysUntil = getDaysUntil(ride.dateTime);
  const isRideToday = isToday(ride.dateTime);
  const startLabel = ride.startLocation?.name || ride.startLocation?.address || 'Start';
  const endLabel = ride.endLocation?.name || ride.endLocation?.address || 'End';
  const isPastDue = ride.status === 'upcoming' && daysUntil < 0;
  const statusTone =
    ride.status === 'completed'
      ? colors.completed
      : ride.status === 'cancelled'
        ? colors.cancelled
        : ride.status === 'active' || isRideToday
          ? colors.heat
          : isPastDue
            ? colors.pending
            : colors.upcoming;
  const statusLabel =
    ride.status === 'completed'
      ? 'Completed'
      : ride.status === 'cancelled'
        ? 'Cancelled'
        : ride.status === 'active'
          ? 'Today'
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

  React.useEffect(() => {
    setImageFailed(false);
  }, [ride.coverImage]);

  if (variant === 'compact') {
    return (
      <Pressable 
        style={({ pressed }) => [styles.compactContainer, pressed && styles.pressed]}
        onPress={handlePress}
      >
        <Image
          source={getCoverImageSource(coverImage)}
          style={styles.compactImage}
          contentFit="cover"
          onError={() => setImageFailed(true)}
        />
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle} numberOfLines={1}>{ride.title}</Text>
          <Text style={styles.compactDate}>{formatDateTime(ride.dateTime)}</Text>
          <View style={styles.compactStats}>
            <View style={styles.compactStat}>
              <MapPin size={12} color={colors.textTertiary} />
              <Text style={styles.compactStatText}>{formatMiles(ride.estimatedDistance)} mi</Text>
            </View>
            <View style={styles.compactStat}>
              <Users size={12} color={colors.textTertiary} />
              <Text style={styles.compactStatText}>{ride.attendees.length}</Text>
            </View>
          </View>
        </View>
        <ChevronRight size={20} color={colors.textTertiary} />
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
          source={getCoverImageSource(coverImage)}
          style={styles.image}
          contentFit="cover"
          onError={() => setImageFailed(true)}
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
        {(ride.status === 'upcoming' || ride.status === 'active' || ride.status === 'completed' || ride.status === 'cancelled') && (
          <View style={[styles.statusBadge, { borderColor: statusTone }]}>
            <Text style={styles.statusText}>
              {statusLabel}
            </Text>
          </View>
        )}
        <View style={styles.imageOverlay}>
          <View style={styles.routePill}>
            <Navigation size={12} color="#FFFFFF" />
            <Text style={styles.routePillText}>{formatMiles(ride.estimatedDistance)} mi</Text>
          </View>
          <Text style={styles.title}>{ride.title}</Text>
          <Text style={styles.date}>{formatDateTime(ride.dateTime)}</Text>
        </View>
      </View>
      <View style={styles.content}>
        <View style={styles.locationRow}>
          <MapPin size={14} color={colors.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {startLabel} → {endLabel}
          </Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Clock size={14} color={colors.textTertiary} />
            <Text style={styles.statText}>{ride.estimatedDuration}</Text>
          </View>
          <View style={styles.stat}>
            <MapPin size={14} color={colors.textTertiary} />
            <Text style={styles.statText}>{formatMiles(ride.estimatedDistance)} mi</Text>
          </View>
          <View style={styles.stat}>
            <Gauge size={14} color={getPaceColor(ride.pace)} />
            <Text style={[styles.statText, { color: getPaceColor(ride.pace) }]}>
              {getPaceLabel(ride.pace)}
            </Text>
          </View>
          <View style={styles.stat}>
            {attendeePreview.length > 0 ? (
              <View style={styles.avatarStack}>
                {attendeePreview.map((member, index) => (
                  <View
                    key={member.id}
                    style={[styles.stackAvatar, index > 0 && styles.stackAvatarOverlap]}
                  >
                    {member.avatar ? (
                      <Image
                        source={getAvatarSource(member.avatar)}
                        style={styles.stackAvatarImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.stackAvatarPlaceholder}>
                        <Text style={styles.stackAvatarInitials}>{getInitials(member.name)}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <Users size={14} color={colors.textTertiary} />
            )}
            <Text style={styles.statText}>{ride.attendees.length} going</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: AppColors, isLight: boolean) => StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    marginHorizontal: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
    shadowColor: colors.heat,
    shadowOpacity: isLight ? 0.08 : 0.18,
    shadowRadius: isLight ? 14 : 22,
    shadowOffset: { width: 0, height: isLight ? 8 : 14 },
    elevation: isLight ? 4 : 10,
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
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(229,229,229,0.2)',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    color: '#FFFFFF',
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
    borderTopColor: colors.border,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  locationText: {
    color: colors.textSecondary,
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
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.surface,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  stackAvatarOverlap: {
    marginLeft: -8,
  },
  stackAvatarImage: {
    width: '100%',
    height: '100%',
  },
  stackAvatarPlaceholder: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackAvatarInitials: {
    color: colors.onPrimary,
    fontSize: 9,
    fontWeight: '700',
  },
  compactContainer: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
  },
  compactImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
  },
  compactContent: {
    flex: 1,
    marginLeft: 12,
  },
  compactTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  compactDate: {
    color: colors.textTertiary,
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
    color: colors.textTertiary,
    fontSize: 12,
  },
});
