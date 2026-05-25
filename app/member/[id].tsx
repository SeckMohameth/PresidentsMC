import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Bike, CalendarDays, Gauge, Route, Trophy, UserRound } from 'lucide-react-native';
import { AppColors, useThemeColors } from '@/constants/colors';
import { useCrew } from '@/providers/CrewProvider';
import { getAvatarSource } from '@/utils/avatar';
import { formatMiles, getInitials } from '@/utils/helpers';
import { BikeProfile } from '@/types';
import { getDefaultRideCoverUri } from '@/constants/coverImages';

function normalizeBikes(memberBike?: string, bikes?: BikeProfile[]) {
  if (bikes?.length) return bikes;
  if (!memberBike) return [];
  return [{
    id: 'legacy-bike',
    name: memberBike,
    createdAt: new Date().toISOString(),
    isPrimary: true,
  }];
}

function formatMemberSince(value?: string) {
  if (!value) return 'New member';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'New member';
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export default function MemberProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { getMemberById, rides, isLoading } = useCrew();
  const member = getMemberById(id || '');

  const stats = useMemo(() => {
    if (!member) {
      return { attended: [], rides: 0, miles: 0, photos: 0, checkedIn: 0 };
    }
    const attended = rides
      .filter((ride) => ride.attendees?.includes(member.id) || ride.checkedIn?.includes(member.id))
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
    return {
      attended,
      rides: attended.length,
      miles: attended.reduce((sum, ride) => sum + (ride.estimatedDistance || 0), 0),
      photos: attended.reduce((sum, ride) => sum + (ride.photos?.filter((photo) => photo.uploadedBy === member.id).length || 0), 0),
      checkedIn: attended.filter((ride) => ride.checkedIn?.includes(member.id)).length,
    };
  }, [member, rides]);

  if (!member && isLoading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTitle}>Loading member...</Text>
      </View>
    );
  }

  if (!member) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyTitle}>Member not found</Text>
        <Pressable style={styles.backPill} onPress={() => router.back()}>
          <Text style={styles.backPillText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const bikes = normalizeBikes(member.bike, member.bikes);
  const primaryBike = bikes.find((bike) => bike.isPrimary) || bikes[0];
  const heroImage = primaryBike?.photoUrl || member.avatar || getDefaultRideCoverUri();
  const memberSince = formatMemberSince(member.joinedCrewAt || member.joinedAt);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 34 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          <Image source={heroImage ? getAvatarSource(heroImage) : undefined} style={styles.heroImage} contentFit="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.92)']}
            locations={[0, 0.48, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={21} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroCopy}>
            <View style={styles.identityRow}>
              {member.avatar ? (
                <Image source={getAvatarSource(member.avatar)} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{getInitials(member.name)}</Text>
                </View>
              )}
              <View style={styles.identityText}>
                <Text style={styles.name}>{member.name}</Text>
                <Text style={styles.role}>
                  {member.leadershipTitle || (member.role === 'admin' ? 'Admin' : member.role === 'officer' ? 'Officer' : 'Member')}
                </Text>
              </View>
            </View>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Total Miles</Text>
                <Text style={styles.heroStatValue}>{formatMiles(stats.miles)}</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatLabel}>Rides</Text>
                <Text style={styles.heroStatValue}>{stats.rides}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.content}>
        <View style={styles.detailsPanel}>
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <UserRound size={17} color={colors.primary} />
            </View>
            <View style={styles.detailBody}>
              <Text style={styles.detailLabel}>Member Since</Text>
              <Text style={styles.detailValue}>{memberSince}</Text>
            </View>
          </View>
          {primaryBike ? (
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Bike size={17} color={colors.primary} />
              </View>
              <View style={styles.detailBody}>
                <Text style={styles.detailLabel}>Primary Bike</Text>
                <Text style={styles.detailValue}>{primaryBike.name}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Route size={18} color={colors.primary} />
            <Text style={styles.statValue}>{stats.rides}</Text>
            <Text style={styles.statLabel}>Rides</Text>
          </View>
          <View style={styles.statCard}>
            <Gauge size={18} color={colors.success} />
            <Text style={styles.statValue}>{formatMiles(stats.miles)}</Text>
            <Text style={styles.statLabel}>Miles</Text>
          </View>
          <View style={styles.statCard}>
            <Trophy size={18} color={colors.warning} />
            <Text style={styles.statValue}>{stats.checkedIn}</Text>
            <Text style={styles.statLabel}>Check-ins</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Garage</Text>
          {bikes.length === 0 ? (
            <View style={styles.emptyCard}>
              <Bike size={20} color={colors.textTertiary} />
              <Text style={styles.emptyText}>No bikes added yet.</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bikeList}>
              {bikes.map((bike) => (
                <View key={bike.id} style={styles.bikeCard}>
                  {bike.photoUrl ? (
                    <Image source={{ uri: bike.photoUrl }} style={styles.bikeImage} contentFit="cover" />
                  ) : (
                    <View style={styles.bikeImageFallback}>
                      <Bike size={28} color={colors.textTertiary} />
                    </View>
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.74)', 'rgba(0,0,0,0.96)']}
                    locations={[0.2, 0.64, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.bikeCopy}>
                    {bike.isPrimary ? (
                      <View style={styles.primaryTag}>
                        <Text style={styles.primaryTagText}>Primary</Text>
                      </View>
                    ) : null}
                    <Text style={styles.bikeName} numberOfLines={1}>{bike.name}</Text>
                    {bike.details ? <Text style={styles.bikeDetails} numberOfLines={2}>{bike.details}</Text> : null}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ride History</Text>
          {stats.attended.slice(0, 6).map((ride) => (
            <Pressable key={ride.id} style={styles.rideRow} onPress={() => router.push(`/ride/${ride.id}`)}>
              <CalendarDays size={18} color={colors.textTertiary} />
              <View style={styles.rideBody}>
                <Text style={styles.rideTitle}>{ride.title}</Text>
                <Text style={styles.rideMeta}>
                  {new Date(ride.dateTime).toLocaleDateString()} • {formatMiles(ride.estimatedDistance || 0)} mi
                </Text>
              </View>
            </Pressable>
          ))}
          {stats.attended.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No ride history yet.</Text>
            </View>
          ) : null}
        </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { paddingHorizontal: 20, maxWidth: 840, width: '100%', alignSelf: 'center' },
  backButton: {
    position: 'absolute',
    top: 56,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(25,25,25,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    zIndex: 3,
  },
  backPill: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, backgroundColor: colors.surface },
  backPillText: { color: colors.text, fontWeight: '700' },
  hero: { minHeight: 520, justifyContent: 'flex-end', overflow: 'hidden', backgroundColor: colors.surface },
  heroImage: { ...StyleSheet.absoluteFill, backgroundColor: colors.surface },
  heroCopy: { paddingHorizontal: 20, paddingBottom: 24, gap: 18 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  identityText: { flex: 1 },
  avatar: { width: 58, height: 58, borderRadius: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  avatarFallback: { width: 58, height: 58, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  avatarInitials: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  name: { color: '#FFFFFF', fontSize: 34, fontWeight: '900' },
  role: { color: 'rgba(255,255,255,0.74)', fontSize: 15, marginTop: 3, fontWeight: '700' },
  heroStats: { flexDirection: 'row', gap: 10 },
  heroStat: { flex: 1, minHeight: 86, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(0,0,0,0.34)', padding: 14, justifyContent: 'space-between' },
  heroStatLabel: { color: 'rgba(255,255,255,0.68)', fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  heroStatValue: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
  detailsPanel: { marginTop: -6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailIcon: { width: 34, height: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
  detailBody: { flex: 1 },
  detailLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  detailValue: { color: colors.text, fontSize: 15, fontWeight: '800', marginTop: 2 },
  statsGrid: { flexDirection: 'row', gap: 10, marginTop: 8 },
  statCard: { flex: 1, minHeight: 104, borderRadius: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, justifyContent: 'space-between' },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '900' },
  statLabel: { color: colors.textTertiary, fontSize: 12, fontWeight: '700' },
  section: { marginTop: 24 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 12 },
  bikeList: { gap: 12, paddingRight: 16 },
  bikeCard: { width: 276, height: 360, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  bikeImage: { ...StyleSheet.absoluteFill },
  bikeImageFallback: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
  bikeCopy: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  primaryTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 3, backgroundColor: 'rgba(216,58,46,0.86)', marginBottom: 10 },
  primaryTagText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  bikeName: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  bikeDetails: { color: 'rgba(255,255,255,0.76)', fontSize: 14, lineHeight: 19, marginTop: 5 },
  rideRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  rideBody: { flex: 1 },
  rideTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  rideMeta: { color: colors.textTertiary, fontSize: 12, marginTop: 3 },
  emptyCard: { minHeight: 88, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, padding: 16 },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  emptyText: { color: colors.textTertiary, fontSize: 14 },
});
