import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, useWindowDimensions, StyleProp, ImageStyle } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, Images, Lock, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppColors, useThemeColors } from '@/constants/colors';
import { useCrew } from '@/providers/CrewProvider';
import { formatDate, isToday } from '@/utils/helpers';

const DEFAULT_ALBUM_IMAGE = require('../../../assets/images/helmet.jpg');

export default function AlbumsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { rides, albums, crewStats, canManageAlbums, isAdmin, isOfficer, isBillingRequired, isSubscriptionActive } = useCrew();
  const [refreshing, setRefreshing] = React.useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const columns = width >= 1024 ? 4 : isTablet ? 3 : 2;
  const horizontalPadding = isTablet ? 24 : 16;
  const gap = 12;
  const albumSize = (width - horizontalPadding * 2 - gap * (columns - 1)) / columns;

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  const albumRides = rides
    .filter((ride) => ride.status === 'completed' || isToday(ride.dateTime))
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  const albumItems = [
    ...albums.map((album) => ({
      id: album.id,
      title: album.title,
      date: album.createdAt,
      photoCount: album.photos.length,
      imageUrl: album.coverImage || album.photos[0]?.imageUrl || '',
    })),
    ...albumRides.map((ride) => ({
      id: ride.id,
      title: ride.title,
      date: ride.dateTime,
      photoCount: ride.photos.length,
      imageUrl: ride.coverImage || ride.photos[0]?.imageUrl || '',
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const showLockedAlbumCreate = !canManageAlbums && (isAdmin || isOfficer) && isBillingRequired && !isSubscriptionActive;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTopRow}>
          <Text style={styles.title}>Albums</Text>
          {canManageAlbums ? (
            <Pressable style={styles.createButton} onPress={() => router.push('/create-album' as any)}>
              <Plus size={18} color={colors.onPrimary} />
              <Text style={styles.createButtonText}>New</Text>
            </Pressable>
          ) : showLockedAlbumCreate ? (
            <Pressable style={[styles.createButton, styles.lockedButton]} onPress={() => router.push('/subscription' as any)}>
              <Lock size={16} color={colors.text} />
              <Text style={styles.lockedButtonText}>Unlock</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Images size={16} color={colors.primary} />
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
            tintColor={colors.primary}
          />
        }
      >
        {albumItems.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Camera size={48} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No Albums Yet</Text>
            <Text style={styles.emptyDescription}>
              Ride albums appear here on ride day. Admins can also create club albums anytime.
            </Text>
            {showLockedAlbumCreate && (
              <Pressable style={styles.emptyButton} onPress={() => router.push('/subscription' as any)}>
                <Lock size={18} color={colors.onPrimary} />
                <Text style={styles.emptyButtonText}>Unlock Albums</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.albumGrid}>
            {albumItems.map((album, index) => (
              <View key={album.id}>
              <Pressable
                style={({ pressed }) => [
                  styles.albumCard,
                  { width: albumSize, height: albumSize * 1.2 },
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push(`/album/${album.id}`)}
              >
                <AlbumCoverImage imageUrl={album.imageUrl} style={styles.albumImage} />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.85)']}
                  style={styles.albumGradient}
                />
                <View style={styles.albumInfo}>
                  <Text style={styles.albumTitle} numberOfLines={2}>{album.title}</Text>
                  <Text style={styles.albumMeta}>
                    {formatDate(album.date)} • {album.photoCount} photos
                  </Text>
                </View>
                {album.photoCount > 1 && (
                  <View style={styles.photoCountBadge}>
                    <Images size={12} color="#FFFFFF" />
                    <Text style={styles.photoCountText}>{album.photoCount}</Text>
                  </View>
                )}
              </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function AlbumCoverImage({ imageUrl, style }: { imageUrl?: string | null; style: StyleProp<ImageStyle> }) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  return (
    <Image
      source={!failed && imageUrl ? { uri: imageUrl } : DEFAULT_ALBUM_IMAGE}
      style={style}
      contentFit="cover"
      onError={() => setFailed(true)}
    />
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  createButton: {
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
  },
  createButtonText: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  lockedButton: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lockedButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
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
    color: colors.textTertiary,
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
    backgroundColor: colors.surface,
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
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
    color: '#FFFFFF',
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
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 15,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  emptyButtonText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
});
