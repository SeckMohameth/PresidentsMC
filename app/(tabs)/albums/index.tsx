import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Images } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import Colors from '@/constants/colors';
import { useCrew } from '@/providers/CrewProvider';
import { formatDate } from '@/utils/helpers';

export default function AlbumsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pastRides, crewStats } = useCrew();
  const [refreshing, setRefreshing] = React.useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const columns = width >= 1024 ? 4 : isTablet ? 3 : 2;
  const horizontalPadding = isTablet ? 24 : 16;
  const gap = 12;
  const albumSize = (width - horizontalPadding * 2 - gap * (columns - 1)) / columns;

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const ridesWithPhotos = pastRides.filter(ride => ride.photos.length > 0);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.title}>Albums</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Images size={16} color={Colors.dark.primary} />
            <Text style={styles.statText}>{crewStats.totalPhotos} photos</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontalPadding },
          isTablet && styles.scrollContentTablet,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={Colors.dark.primary}
          />
        }
      >
        {ridesWithPhotos.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Camera size={48} color={Colors.dark.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No Photos Yet</Text>
            <Text style={styles.emptyDescription}>
              Photos from completed rides will appear here. Complete a ride and upload some memories!
            </Text>
          </View>
        ) : (
          <View style={styles.albumGrid}>
            {ridesWithPhotos.map((ride, index) => (
              <Animated.View
                key={ride.id}
                entering={FadeInDown.delay(index * 55).duration(320)}
                layout={Layout.springify().damping(18)}
              >
              <Pressable
                style={({ pressed }) => [
                  styles.albumCard,
                  { width: albumSize, height: albumSize * 1.2 },
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push(`/album/${ride.id}`)}
              >
                <Image 
                  source={{ uri: ride.photos[0]?.imageUrl || ride.coverImage }}
                  style={styles.albumImage}
                  contentFit="cover"
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.85)']}
                  style={styles.albumGradient}
                />
                <View style={styles.albumInfo}>
                  <Text style={styles.albumTitle} numberOfLines={2}>{ride.title}</Text>
                  <Text style={styles.albumMeta}>
                    {formatDate(ride.dateTime)} • {ride.photos.length} photos
                  </Text>
                </View>
                {ride.photos.length > 1 && (
                  <View style={styles.photoCountBadge}>
                    <Images size={12} color={Colors.dark.text} />
                    <Text style={styles.photoCountText}>{ride.photos.length}</Text>
                  </View>
                )}
              </Pressable>
              </Animated.View>
            ))}
          </View>
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.dark.text,
    letterSpacing: -0.5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    color: Colors.dark.textTertiary,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  scrollContentTablet: {
    maxWidth: 960,
    alignSelf: 'center',
    width: '100%',
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  albumCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.dark.surface,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  albumImage: {
    width: '100%',
    height: '100%',
  },
  albumGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  albumInfo: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  albumTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 20,
  },
  albumMeta: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  photoCountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoCountText: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: '600',
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
  },
});
