import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Route, MapPin, Camera, Users, Flame, Trophy, TrendingUp, Calendar, History, Bike, CheckCircle2, Clock, Gauge, Info, ChevronDown, ChevronUp } from 'lucide-react-native';
import { AppColors, useThemeColors } from '@/constants/colors';
import { useCrew } from '@/providers/CrewProvider';
import StatCard from '@/components/StatCard';
import { getAvatarSource } from '@/utils/avatar';
import { formatMiles, formatNumber } from '@/utils/helpers';

type TabType = 'crew' | 'personal';

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { crewStats, memberStats, currentUser, crew, statsHistory, pastRides } = useCrew();
  const [activeTab, setActiveTab] = useState<TabType>('crew');
  const [showAbout, setShowAbout] = useState(false);
  const [historyPeriod, setHistoryPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);
  const crewCreatedAt = crew?.createdAt ? new Date(crew.createdAt) : null;
  const crewEstablishedYear =
    crewCreatedAt && !Number.isNaN(crewCreatedAt.getTime())
      ? crewCreatedAt.getFullYear()
      : null;
  const personalRideHistory = currentUser
    ? pastRides.filter((ride) => ride.attendees?.includes(currentUser.id))
    : [];

  const renderRideHistoryCard = (ride: (typeof pastRides)[number], showPersonalStatus = false) => {
    const checkedInCount = ride.checkedIn?.length || 0;
    const attendeeCount = ride.attendees?.length || 0;
    const photoCount = ride.photos?.length || 0;
    const didAttend = !!currentUser?.id && ride.attendees?.includes(currentUser.id);
    const didCheckIn = !!currentUser?.id && ride.checkedIn?.includes(currentUser.id);

    return (
      <View key={ride.id} style={styles.rideHistoryCard}>
        <View style={styles.rideHistoryHeader}>
          <View style={styles.rideHistoryTitleWrap}>
            <Text style={styles.rideHistoryTitle}>{ride.title}</Text>
            <Text style={styles.rideHistoryDate}>
              {new Date(ride.dateTime).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.rideMilesPill}>
            <MapPin size={13} color={colors.success} />
            <Text style={styles.rideMilesText}>{formatMiles(ride.estimatedDistance)}</Text>
          </View>
        </View>

        <View style={styles.routeSummary}>
          <View style={styles.routePointRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.success }]} />
            <Text style={styles.routePointText} numberOfLines={1}>
              {ride.startLocation?.name || ride.startLocation?.address || 'Start not set'}
            </Text>
          </View>
          <View style={styles.routePointRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.error }]} />
            <Text style={styles.routePointText} numberOfLines={1}>
              {ride.endLocation?.name || ride.endLocation?.address || 'End not set'}
            </Text>
          </View>
        </View>

        <View style={styles.rideMetaGrid}>
          <View style={styles.rideMetaItem}>
            <Clock size={14} color={colors.textTertiary} />
            <Text style={styles.rideMetaText}>{ride.estimatedDuration || 'Duration not set'}</Text>
          </View>
          <View style={styles.rideMetaItem}>
            <Gauge size={14} color={colors.textTertiary} />
            <Text style={styles.rideMetaText}>{ride.pace || 'pace'} pace</Text>
          </View>
          <View style={styles.rideMetaItem}>
            <Users size={14} color={colors.textTertiary} />
            <Text style={styles.rideMetaText}>{attendeeCount} going</Text>
          </View>
          <View style={styles.rideMetaItem}>
            <CheckCircle2 size={14} color={colors.textTertiary} />
            <Text style={styles.rideMetaText}>{checkedInCount} checked in</Text>
          </View>
          <View style={styles.rideMetaItem}>
            <Camera size={14} color={colors.textTertiary} />
            <Text style={styles.rideMetaText}>{photoCount} photos</Text>
          </View>
        </View>

        {showPersonalStatus && (
          <Text style={styles.personalRideStatus}>
            {didCheckIn ? 'You checked in for this ride.' : didAttend ? 'You were marked as going.' : 'You did not attend this ride.'}
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Stats</Text>
        <View style={styles.tabs}>
          <Pressable 
            style={[styles.tab, activeTab === 'crew' && styles.activeTab]}
            onPress={() => setActiveTab('crew')}
          >
            <Users size={16} color={activeTab === 'crew' ? colors.primary : colors.textTertiary} />
            <Text style={[styles.tabText, activeTab === 'crew' && styles.activeTabText]}>
              Crew Stats
            </Text>
          </Pressable>
          <Pressable 
            style={[styles.tab, activeTab === 'personal' && styles.activeTab]}
            onPress={() => setActiveTab('personal')}
          >
            <TrendingUp size={16} color={activeTab === 'personal' ? colors.primary : colors.textTertiary} />
            <Text style={[styles.tabText, activeTab === 'personal' && styles.activeTabText]}>
              My Stats
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120 },
          isTablet && styles.scrollContentTablet,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {activeTab === 'crew' ? (
          <>
            <View style={styles.heroCard}>
              <Image 
                source={{ uri: crew?.coverImage }}
                style={styles.heroImage}
                contentFit="cover"
              />
              <View style={styles.heroOverlay} />
              <View style={styles.heroContent}>
                {crew?.logoUrl ? (
                  <Image source={{ uri: crew.logoUrl }} style={styles.heroLogo} contentFit="cover" />
                ) : null}
                <Text style={styles.heroTitle}>{crew?.name}</Text>
                {crewEstablishedYear ? (
                  <Text style={styles.heroSubtitle}>Est. {crewEstablishedYear}</Text>
                ) : null}
              </View>
            </View>

            {crew?.description?.trim() ? (
              <Pressable
                style={styles.aboutCard}
                onPress={() => setShowAbout((value) => !value)}
              >
                <View style={styles.aboutHeader}>
                  <View style={styles.aboutHeaderLeft}>
                    <Info size={18} color={colors.primary} />
                    <Text style={styles.aboutTitle}>About the Club</Text>
                  </View>
                  {showAbout ? (
                    <ChevronUp size={18} color={colors.textTertiary} />
                  ) : (
                    <ChevronDown size={18} color={colors.textTertiary} />
                  )}
                </View>
                <Text
                  style={styles.aboutText}
                  numberOfLines={showAbout ? undefined : 2}
                >
                  {crew.description.trim()}
                </Text>
              </Pressable>
            ) : null}

            <Text style={styles.sectionTitle}>All Time</Text>
            <View style={styles.statsGrid}>
              <StatCard 
                icon={Route} 
                label="Total Rides" 
                value={crewStats.totalRides}
                color={colors.primary}
              />
              <StatCard 
                icon={MapPin} 
                label="Miles Traveled" 
                value={formatMiles(crewStats.totalMiles)}
                color={colors.success}
              />
            </View>
            <View style={styles.statsGrid}>
              <StatCard 
                icon={Camera} 
                label="Photos" 
                value={formatNumber(crewStats.totalPhotos)}
                color={colors.accent}
              />
              <StatCard 
                icon={Users} 
                label="Members" 
                value={crewStats.totalMembers}
                color="#8B5CF6"
              />
            </View>

            <Text style={styles.sectionTitle}>This Month</Text>
            <View style={styles.statsGrid}>
              <StatCard 
                icon={Calendar} 
                label="Rides" 
                value={crewStats.ridesThisMonth}
                subtitle="rides completed"
                color={colors.primary}
              />
              <StatCard 
                icon={MapPin} 
                label="Miles" 
                value={formatMiles(crewStats.milesThisMonth)}
                subtitle="this month"
                color={colors.success}
              />
            </View>

            <Text style={styles.sectionTitle}>Stats History</Text>
            <View style={styles.historyTabs}>
              {(['week', 'month', 'year'] as const).map((period) => (
                <Pressable
                  key={period}
                  style={[styles.historyTab, historyPeriod === period && styles.historyTabActive]}
                  onPress={() => setHistoryPeriod(period)}
                >
                  <Text style={[styles.historyTabText, historyPeriod === period && styles.historyTabTextActive]}>
                    {period === 'week' ? 'Weekly' : period === 'month' ? 'Monthly' : 'Yearly'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.historyList}>
              {statsHistory.filter((item) => item.period === historyPeriod).length === 0 ? (
                <View style={styles.historyEmpty}>
                  <History size={20} color={colors.textTertiary} />
                  <Text style={styles.historyEmptyText}>No archived stats yet</Text>
                </View>
              ) : (
                statsHistory
                  .filter((item) => item.period === historyPeriod)
                  .slice(0, 10)
                  .map((item) => (
                    <View key={item.id} style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <Text style={styles.historyRange}>
                          {new Date(item.periodStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                          {new Date(item.periodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                        <Text style={styles.historyPeriod}>{item.period.toUpperCase()}</Text>
                      </View>
                      <View style={styles.historyStatsRow}>
                        <Text style={styles.historyStat}>Rides: {item.totalRides}</Text>
                        <Text style={styles.historyStat}>Miles: {formatMiles(item.totalMiles)}</Text>
                        <Text style={styles.historyStat}>Photos: {formatNumber(item.totalPhotos)}</Text>
                      </View>
                    </View>
                  ))
              )}
            </View>

            <Text style={styles.sectionTitle}>Ride History</Text>
            <View style={styles.rideHistoryList}>
              {pastRides.length === 0 ? (
                <Text style={styles.historyEmptyText}>No completed rides yet</Text>
              ) : (
                pastRides.slice(0, 10).map((ride) => renderRideHistoryCard(ride))
              )}
            </View>
          </>
        ) : (
          <>
            <View style={styles.profileCard}>
              <Image 
                source={getAvatarSource(currentUser?.avatar)}
                style={styles.profileImage}
                contentFit="cover"
              />
              <Text style={styles.profileName}>{currentUser?.name}</Text>
              <Text style={styles.profileRole}>
                {currentUser?.role === 'admin' ? 'Admin' : currentUser?.role === 'officer' ? 'Officer' : 'Member'}
              </Text>
              <View style={styles.bikePill}>
                <Bike size={14} color={colors.textSecondary} />
                <Text style={styles.bikePillText}>
                  {currentUser?.bike || 'Add your bike in Profile'}
                </Text>
              </View>
              <Text style={styles.memberSince}>
                Member since {new Date(memberStats.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
            </View>

            <Text style={styles.sectionTitle}>My Biker Stats</Text>
            <View style={styles.statsGrid}>
              <StatCard 
                icon={Route} 
                label="Rides Attended" 
                value={memberStats.ridesAttended}
                color={colors.primary}
              />
              <StatCard 
                icon={MapPin} 
                label="Miles Traveled" 
                value={formatMiles(memberStats.milesTraveled)}
                color={colors.success}
              />
            </View>

            <Text style={styles.sectionTitle}>Streaks</Text>
            <View style={styles.statsGrid}>
              <StatCard 
                icon={Flame} 
                label="Current Streak" 
                value={memberStats.currentStreak}
                subtitle="consecutive rides"
                color={colors.error}
              />
              <StatCard 
                icon={Trophy} 
                label="Longest Streak" 
                value={memberStats.longestStreak}
                subtitle="personal best"
                color={colors.warning}
              />
            </View>

            <Text style={styles.sectionTitle}>My Ride History</Text>
            <View style={styles.rideHistoryList}>
              {personalRideHistory.length === 0 ? (
                <Text style={styles.historyEmptyText}>No attended rides yet</Text>
              ) : (
                personalRideHistory.slice(0, 10).map((ride) => renderRideHistoryCard(ride, true))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: colors.surfaceElevated,
  },
  tabText: {
    color: colors.textTertiary,
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  scrollContentTablet: {
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },
  heroCard: {
    height: 160,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  heroContent: {
    position: 'absolute',
    bottom: 20,
    left: 20,
  },
  heroLogo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: colors.background,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 4,
  },
  aboutCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aboutHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aboutTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  aboutText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 24,
    backgroundColor: colors.surface,
    borderRadius: 20,
  },
  profileImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  profileName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileRole: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  bikePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  bikePillText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  memberSince: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  historyTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  historyTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  historyTabActive: {
    backgroundColor: colors.surfaceElevated,
  },
  historyTabText: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '600',
  },
  historyTabTextActive: {
    color: colors.text,
  },
  historyList: {
    marginBottom: 16,
  },
  historyEmpty: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  historyEmptyText: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyRange: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  historyPeriod: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  historyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyStat: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  rideHistoryList: {
    marginBottom: 16,
  },
  rideHistoryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  rideHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  rideHistoryTitleWrap: {
    flex: 1,
  },
  rideHistoryTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  rideHistoryDate: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  rideMilesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rideMilesText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  routeSummary: {
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routePointText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  rideMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rideMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: '30%',
  },
  rideMetaText: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  personalRideStatus: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
  },
});
