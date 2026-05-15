import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Calendar, History } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useCrew } from '@/providers/CrewProvider';
import RideCard from '@/components/RideCard';

type TabType = 'upcoming' | 'past';

export default function RidesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { upcomingRides, pastRides, canPost } = useCrew();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const rides = activeTab === 'upcoming' ? upcomingRides : pastRides;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Rides</Text>
          {canPost && (
            <Pressable 
              style={styles.createButton}
              onPress={() => router.push('/create-ride')}
            >
              <Plus size={20} color={Colors.dark.text} />
              <Text style={styles.createButtonText}>New Ride</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.tabs}>
          <Pressable 
            style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
            onPress={() => setActiveTab('upcoming')}
          >
            <Calendar size={16} color={activeTab === 'upcoming' ? Colors.dark.primary : Colors.dark.textTertiary} />
            <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
              Upcoming
            </Text>
            {upcomingRides.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{upcomingRides.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable 
            style={[styles.tab, activeTab === 'past' && styles.activeTab]}
            onPress={() => setActiveTab('past')}
          >
            <History size={16} color={activeTab === 'past' ? Colors.dark.primary : Colors.dark.textTertiary} />
            <Text style={[styles.tabText, activeTab === 'past' && styles.activeTabText]}>
              Past
            </Text>
          </Pressable>
        </View>
      </View>

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
        {rides.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              {activeTab === 'upcoming' ? (
                <Calendar size={48} color={Colors.dark.textTertiary} />
              ) : (
                <History size={48} color={Colors.dark.textTertiary} />
              )}
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'upcoming' ? 'No Upcoming Rides' : 'No Past Rides'}
            </Text>
            <Text style={styles.emptyDescription}>
              {activeTab === 'upcoming' 
                ? 'When rides are scheduled, they\'ll show up here.'
                : 'Completed rides will appear here.'}
            </Text>
            {activeTab === 'upcoming' && canPost && (
              <Pressable 
                style={styles.emptyButton}
                onPress={() => router.push('/create-ride')}
              >
                <Plus size={18} color={Colors.dark.text} />
                <Text style={styles.emptyButtonText}>Schedule a Ride</Text>
              </Pressable>
            )}
          </View>
        ) : (
          rides.map(ride => (
            <RideCard 
              key={ride.id} 
              ride={ride} 
              variant={activeTab === 'past' ? 'compact' : 'default'}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: -0.5,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  createButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
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
    backgroundColor: Colors.dark.surfaceElevated,
  },
  tabText: {
    color: Colors.dark.textTertiary,
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: Colors.dark.primary,
  },
  tabBadge: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  scrollContentTablet: {
    paddingHorizontal: 24,
    maxWidth: 840,
    alignSelf: 'center',
    width: '100%',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    color: Colors.dark.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
  },
  emptyButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
