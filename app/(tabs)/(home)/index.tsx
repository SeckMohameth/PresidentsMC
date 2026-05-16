import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Users, Bell, Route, Gauge, Images, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { Art } from '@/constants/art';
import { useCrew } from '@/providers/CrewProvider';
import AnnouncementCard from '@/components/AnnouncementCard';
import RideCard from '@/components/RideCard';
import { getAvatarSource } from '@/utils/avatar';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { crew, currentUser, announcements, upcomingRides, canPost, isAdmin, isLoading, toggleAnnouncementLike } = useCrew();
  const [refreshing, setRefreshing] = React.useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  const nextRide = upcomingRides[0];
  const heroImage = nextRide?.coverImage || crew?.coverImage || Art.heroBike;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={Colors.dark.primary}
          />
        }
      >
        <View style={styles.hero}>
          <Image source={{ uri: heroImage }} style={styles.heroImage} contentFit="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.12)', 'rgba(5,5,5,0.24)', Colors.dark.background]}
            locations={[0, 0.55, 1]}
            style={styles.heroOverlay}
          />
          <LinearGradient
            colors={['rgba(216,58,46,0.42)', 'transparent']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroHeat}
          />
          <View style={[styles.heroTop, { paddingTop: insets.top + 8 }]}>
            <View>
              <Text style={styles.eyebrow}>Private Club</Text>
              <Text style={styles.crewName}>{crew?.name || 'PresidentsMC'}</Text>
            </View>
            <Pressable style={styles.profileButton} onPress={() => router.push('/(tabs)/more')}>
              {currentUser?.avatar ? (
                <Image source={getAvatarSource(currentUser.avatar)} style={styles.profileImage} contentFit="cover" />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Text style={styles.profileInitials}>{currentUser?.name.charAt(0) || 'U'}</Text>
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>
              {nextRide ? nextRide.title : 'Ride coordination built for the club'}
            </Text>
            <Text style={styles.heroSubtitle}>
              {nextRide ? 'Next ride is locked in. Check the route, meet point, and who is rolling.' : 'Announcements, rides, photos, stats, and members in one private garage.'}
            </Text>
            <Pressable
              style={styles.heroAction}
              onPress={() => router.push(nextRide ? `/ride/${nextRide.id}` : '/(tabs)/rides')}
            >
              <Text style={styles.heroActionText}>{nextRide ? 'View Ride' : 'Open Rides'}</Text>
              <ChevronRight size={18} color={Colors.dark.background} />
            </Pressable>
          </View>
        </View>

        <View style={styles.statsRail}>
          <View style={styles.statTile}>
            <Users size={16} color={Colors.dark.primary} />
            <Text style={styles.statValue}>{crew?.memberCount || 0}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.statTile}>
            <Route size={16} color={Colors.dark.primary} />
            <Text style={styles.statValue}>{crew?.totalRides || 0}</Text>
            <Text style={styles.statLabel}>Rides</Text>
          </View>
          <View style={styles.statTile}>
            <Gauge size={16} color={Colors.dark.primary} />
            <Text style={styles.statValue}>{Math.round(crew?.totalMiles || 0)}</Text>
            <Text style={styles.statLabel}>Miles</Text>
          </View>
          <View style={styles.statTile}>
            <Images size={16} color={Colors.dark.primary} />
            <Text style={styles.statValue}>{crew?.totalPhotos || 0}</Text>
            <Text style={styles.statLabel}>Photos</Text>
          </View>
        </View>

        {nextRide && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Next Ride</Text>
              <Pressable onPress={() => router.push('/(tabs)/rides')}>
                <Text style={styles.seeAll}>See All</Text>
              </Pressable>
            </View>
            <RideCard ride={nextRide} />
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Bell size={18} color={Colors.dark.primary} />
              <Text style={styles.sectionTitle}>Announcements</Text>
            </View>
            {canPost && (
              <Pressable 
                style={styles.addButton}
                onPress={() => router.push('/create-announcement')}
              >
                <Plus size={18} color={Colors.dark.primary} />
              </Pressable>
            )}
          </View>
          {announcements.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No announcements yet</Text>
            </View>
          ) : (
            announcements.map(announcement => (
              <AnnouncementCard 
                key={announcement.id} 
                announcement={announcement}
                onToggleLike={() => toggleAnnouncementLike(announcement.id)}
                onEdit={isAdmin ? () => router.push({ pathname: '/create-announcement', params: { announcementId: announcement.id } }) : undefined}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  crewInfo: {
    flex: 1,
  },
  crewName: {
    fontSize: 30,
    fontWeight: '900',
    color: Colors.dark.text,
    letterSpacing: 0,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  memberCount: {
    color: Colors.dark.textTertiary,
    fontSize: 14,
    fontWeight: '500',
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(10,10,10,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(229,229,229,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profilePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    color: Colors.dark.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 122,
  },
  scrollContentTablet: {
    paddingHorizontal: 24,
    maxWidth: 840,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.dark.text,
  },
  seeAll: {
    color: Colors.dark.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(229,229,229,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.borderLight,
  },
  emptyState: {
    marginHorizontal: 16,
    padding: 32,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.dark.textTertiary,
    fontSize: 15,
  },
  hero: {
    height: 430,
    marginBottom: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroHeat: {
    position: 'absolute',
    left: -40,
    right: 0,
    bottom: 0,
    height: 170,
  },
  heroTop: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  heroContent: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 26,
  },
  heroTitle: {
    color: Colors.dark.text,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 39,
    marginBottom: 10,
  },
  heroSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 340,
    marginBottom: 18,
  },
  heroAction: {
    alignSelf: 'flex-start',
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 23,
    backgroundColor: Colors.dark.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroActionText: {
    color: Colors.dark.background,
    fontSize: 15,
    fontWeight: '900',
  },
  statsRail: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statTile: {
    flex: 1,
    minHeight: 86,
    backgroundColor: 'rgba(22,22,23,0.84)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    padding: 12,
    justifyContent: 'space-between',
  },
  statValue: {
    color: Colors.dark.text,
    fontSize: 21,
    fontWeight: '900',
  },
  statLabel: {
    color: Colors.dark.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
