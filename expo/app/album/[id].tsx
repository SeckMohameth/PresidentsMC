import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, X, Camera, Plus, Trash2, Pencil } from 'lucide-react-native';
import { AppColors, useThemeColors } from '@/constants/colors';
import { useCrew, useRide } from '@/providers/CrewProvider';
import { formatDate, formatRelativeTime } from '@/utils/helpers';
import { RidePhoto } from '@/types';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const {
    addPhoto,
    addAlbumPhoto,
    deleteRidePhoto,
    deleteAlbumPhoto,
    deleteAlbum,
    getAlbumById,
    canManageRides,
    canManageAlbums,
  } = useCrew();
  const { ride } = useRide(id || '');
  const album = getAlbumById(id || '');
  const galleryRef = useRef<FlatList<RidePhoto>>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [isDeletingAlbum, setIsDeletingAlbum] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isLoadingMoreLibrary, setIsLoadingMoreLibrary] = useState(false);
  const [libraryEndCursor, setLibraryEndCursor] = useState<string | undefined>();
  const [libraryHasNextPage, setLibraryHasNextPage] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<MediaLibrary.Asset[]>([]);
  const [loadedPhotoIds, setLoadedPhotoIds] = useState<Set<string>>(() => new Set());
  const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(() => new Set());
  const isTablet = width >= 768;
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const columnCount = isTablet ? 5 : 3;
  const gridWidth = Math.min(width, 980);
  const gridPadding = isTablet ? 24 : 16;
  const gridGap = isTablet ? 8 : 4;
  const photoSize = (gridWidth - gridPadding * 2 - gridGap * (columnCount - 1)) / columnCount;

  const title = ride?.title || album?.title || '';
  const date = ride?.dateTime || album?.createdAt || '';
  const photos = ride?.photos || album?.photos || [];
  const isRideAlbum = !!ride;
  const canDeletePhotos = isRideAlbum ? canManageRides : canManageAlbums;
  const selectedPhoto = selectedPhotoIndex === null ? null : photos[selectedPhotoIndex] ?? null;

  const markPhotoLoaded = (photoId: string) => {
    setLoadedPhotoIds((current) => {
      if (current.has(photoId)) return current;
      const next = new Set(current);
      next.add(photoId);
      return next;
    });
  };

  const markPhotoFailed = (photoId: string) => {
    setFailedPhotoIds((current) => {
      if (current.has(photoId)) return current;
      const next = new Set(current);
      next.add(photoId);
      return next;
    });
  };

  if (!ride && !album) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Album not found</Text>
      </View>
    );
  }

  const loadLibraryAssets = async ({ after, reset }: { after?: string; reset?: boolean } = {}) => {
    if (reset) {
      setIsLoadingLibrary(true);
    } else {
      if (isLoadingMoreLibrary || !libraryHasNextPage) return;
      setIsLoadingMoreLibrary(true);
    }
    try {
      const result = await MediaLibrary.getAssetsAsync({
        first: 90,
        after,
        mediaType: 'photo',
        sortBy: [['creationTime', false]],
      });

      setLibraryAssets((current) => {
        if (reset) return result.assets;
        const seen = new Set(current.map((asset) => asset.id));
        return [...current, ...result.assets.filter((asset) => !seen.has(asset.id))];
      });
      setLibraryEndCursor(result.endCursor);
      setLibraryHasNextPage(result.hasNextPage);
    } catch (error) {
      if (__DEV__) {
        console.log('[Album] Photo library error:', error);
      }
      Alert.alert('Photo Error', 'Unable to open your photo library right now.');
    } finally {
      setIsLoadingLibrary(false);
      setIsLoadingMoreLibrary(false);
    }
  };

  const handleAddPhoto = async () => {
    if (isAddingPhoto || isLoadingLibrary) return;

    setIsLoadingLibrary(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo permissions to add album photos.');
        return;
      }

      setLibraryAssets([]);
      setLibraryEndCursor(undefined);
      setLibraryHasNextPage(false);
      setIsLibraryOpen(true);
      await loadLibraryAssets({ reset: true });
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const loadMoreLibraryAssets = () => {
    if (!libraryEndCursor) return;
    loadLibraryAssets({ after: libraryEndCursor });
  };

  const handleSelectLibraryAsset = async (asset: MediaLibrary.Asset) => {
    if (isAddingPhoto) return;

    setIsAddingPhoto(true);
    try {
      const assetInfo = await MediaLibrary.getAssetInfoAsync(asset, {
        shouldDownloadFromNetwork: true,
      });
      const imageUri = assetInfo.localUri || assetInfo.uri || asset.uri;
      if (!imageUri || imageUri.startsWith('ph://')) {
        throw new Error('Photo is not available locally yet.');
      }

      if (isRideAlbum && ride) {
        await addPhoto({ rideId: ride.id, imageUrl: imageUri });
      } else if (album) {
        await addAlbumPhoto({ albumId: album.id, imageUrl: imageUri });
      }

      setIsLibraryOpen(false);
    } catch (error) {
      if (__DEV__) {
        console.log('[Album] Photo upload error:', error);
      }
      const message = String((error as any)?.message ?? '');
      Alert.alert(
        'Upload Failed',
        message.includes('SUBSCRIPTION_INACTIVE')
          ? 'The club subscription must be active before members can add album photos.'
          : 'Unable to add this photo right now. Please try another photo.'
      );
    } finally {
      setIsAddingPhoto(false);
    }
  };

  const openGallery = (index: number) => {
    setSelectedPhotoIndex(index);
    requestAnimationFrame(() => {
      galleryRef.current?.scrollToIndex({ index, animated: false });
    });
  };

  const closeGallery = () => {
    setSelectedPhotoIndex(null);
  };

  const handleDeleteSelectedPhoto = () => {
    if (!selectedPhoto || selectedPhotoIndex === null || isDeletingPhoto) return;

    Alert.alert('Delete Photo', 'Remove this photo from the album?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsDeletingPhoto(true);
          try {
            if (isRideAlbum && ride) {
              await deleteRidePhoto({ rideId: ride.id, photo: selectedPhoto });
            } else if (album) {
              await deleteAlbumPhoto({ albumId: album.id, photo: selectedPhoto });
            }

            const nextLength = photos.length - 1;
            if (nextLength <= 0) {
              closeGallery();
            } else {
              setSelectedPhotoIndex(Math.min(selectedPhotoIndex, nextLength - 1));
            }
          } catch (error) {
            if (__DEV__) {
              console.log('[Album] Photo delete error:', error);
            }
            Alert.alert('Delete Failed', 'Unable to delete this photo right now.');
          } finally {
            setIsDeletingPhoto(false);
          }
        },
      },
    ]);
  };

  // Edit/delete apply only to crew albums (ride albums are managed from the ride).
  const canManageThisAlbum = !isRideAlbum && !!album && canManageAlbums;

  const handleEditAlbum = () => {
    if (!album) return;
    router.push(`/create-album?albumId=${album.id}`);
  };

  const handleDeleteAlbum = () => {
    if (!album || isDeletingAlbum) return;
    const photoCount = album.photos?.length ?? 0;
    Alert.alert(
      'Delete Album',
      photoCount > 0
        ? `This permanently deletes "${album.title}" and all ${photoCount} photo${photoCount === 1 ? '' : 's'} in it. This cannot be undone.`
        : `This permanently deletes "${album.title}". This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Album',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAlbum(true);
            try {
              await deleteAlbum(album.id);
              router.back();
            } catch (error) {
              if (__DEV__) {
                console.log('[Album] Album delete error:', error);
              }
              const message = String((error as any)?.message ?? '');
              Alert.alert(
                'Delete Failed',
                message.includes('NOT_AUTHORIZED')
                  ? 'You do not have permission to delete this album.'
                  : 'Unable to delete this album right now.'
              );
              setIsDeletingAlbum(false);
            }
          },
        },
      ]
    );
  };

  const renderPhoto = ({ item, index }: { item: RidePhoto; index: number }) => {
    const isLoaded = loadedPhotoIds.has(item.id);
    const didFail = failedPhotoIds.has(item.id);

    return (
      <Pressable
        style={[
          styles.photoItem,
          {
            width: photoSize,
            height: photoSize,
            marginRight: (index + 1) % columnCount === 0 ? 0 : gridGap,
            marginBottom: gridGap,
          }
        ]}
        onPress={() => openGallery(index)}
      >
        {!isLoaded && !didFail && (
          <View style={styles.photoLoadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
        {didFail && (
          <View style={styles.photoErrorOverlay}>
            <Camera size={20} color={colors.textTertiary} />
          </View>
        )}
        <Image
          source={{ uri: item.imageUrl }}
          style={[styles.photoImage, !isLoaded && styles.photoImageLoading]}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={item.id}
          transition={140}
          onLoad={() => markPhotoLoaded(item.id)}
          onError={() => markPhotoFailed(item.id)}
        />
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.headerSubtitle}>{formatDate(date)} • {photos.length} photos</Text>
        </View>
        <View style={styles.headerActions}>
          {canManageThisAlbum && (
            <>
              <Pressable style={styles.iconButton} onPress={handleEditAlbum} disabled={isDeletingAlbum}>
                <Pencil size={20} color={colors.text} />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={handleDeleteAlbum} disabled={isDeletingAlbum}>
                {isDeletingAlbum ? <ActivityIndicator color={colors.error} /> : <Trash2 size={20} color={colors.error} />}
              </Pressable>
            </>
          )}
          <Pressable
            style={[styles.addButton, (isAddingPhoto || isLoadingLibrary) && styles.disabledButton]}
            onPress={handleAddPhoto}
            disabled={isAddingPhoto || isLoadingLibrary}
          >
            {isLoadingLibrary ? <ActivityIndicator color={colors.onPrimary} /> : <Plus size={20} color={colors.onPrimary} />}
          </Pressable>
        </View>
      </View>

      {photos.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Camera size={48} color={colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No Photos Yet</Text>
          <Text style={styles.emptyDescription}>
            Be the first to add photos to this album.
          </Text>
          <Pressable
            style={[styles.emptyButton, (isAddingPhoto || isLoadingLibrary) && styles.disabledButton]}
            onPress={handleAddPhoto}
            disabled={isAddingPhoto || isLoadingLibrary}
          >
            {isLoadingLibrary ? <ActivityIndicator color={colors.onPrimary} /> : <Plus size={18} color={colors.onPrimary} />}
            <Text style={styles.emptyButtonText}>{isAddingPhoto || isLoadingLibrary ? 'Adding...' : 'Add Photos'}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={item => item.id}
          key={columnCount}
          numColumns={columnCount}
          contentContainerStyle={[
            styles.gridContent,
            {
              width: gridWidth,
              padding: gridPadding,
            },
          ]}
          style={styles.gridList}
          showsVerticalScrollIndicator={false}
          initialNumToRender={columnCount * 4}
          maxToRenderPerBatch={columnCount * 3}
          updateCellsBatchingPeriod={60}
          windowSize={7}
          removeClippedSubviews
        />
      )}

      <Modal
        visible={isLibraryOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsLibraryOpen(false)}
      >
        <View style={styles.libraryModal}>
          <View style={[styles.libraryHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.libraryTitle}>Choose Photo</Text>
            <Pressable style={styles.libraryClose} onPress={() => setIsLibraryOpen(false)}>
              <X size={22} color={colors.text} />
            </Pressable>
          </View>
          <FlatList
            data={libraryAssets}
            keyExtractor={(item) => item.id}
            numColumns={3}
            contentContainerStyle={styles.libraryGrid}
            onEndReached={loadMoreLibraryAssets}
            onEndReachedThreshold={0.7}
            renderItem={({ item }) => (
              <Pressable
                style={styles.libraryAsset}
                onPress={() => handleSelectLibraryAsset(item)}
                disabled={isAddingPhoto}
              >
                <Image source={{ uri: item.uri }} style={styles.libraryImage} contentFit="cover" />
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.libraryEmpty}>
                <Text style={styles.emptyDescription}>No photos found.</Text>
              </View>
            }
            ListFooterComponent={
              isLoadingMoreLibrary ? (
                <View style={styles.libraryFooter}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : null
            }
          />
          {isAddingPhoto ? (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.uploadText}>Uploading...</Text>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={selectedPhotoIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={closeGallery}
      >
        <View style={styles.modalContainer}>
          <Pressable 
            style={[styles.modalClose, { top: insets.top + 16 }]}
            onPress={closeGallery}
          >
            <X size={24} color={colors.text} />
          </Pressable>
          {canDeletePhotos && selectedPhoto ? (
            <Pressable
              style={[styles.modalDelete, { top: insets.top + 16 }]}
              onPress={handleDeleteSelectedPhoto}
              disabled={isDeletingPhoto}
            >
              {isDeletingPhoto ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Trash2 size={22} color={colors.error} />
              )}
            </Pressable>
          ) : null}
          <FlatList
            ref={galleryRef}
            data={photos}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={selectedPhotoIndex ?? 0}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
              setSelectedPhotoIndex(nextIndex);
            }}
            renderItem={({ item }) => (
              <ZoomableGalleryPhoto photo={item} width={width} />
            )}
          />
          {selectedPhoto && (
            <View style={[styles.modalInfo, { paddingBottom: insets.bottom + 20 }]}>
              <Text style={styles.modalCounter}>
                {selectedPhotoIndex === null ? 0 : selectedPhotoIndex + 1} / {photos.length}
              </Text>
              <Text style={styles.modalAuthor}>{selectedPhoto.uploadedByName}</Text>
              <Text style={styles.modalDate}>{formatRelativeTime(selectedPhoto.uploadedAt)}</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

function ZoomableGalleryPhoto({ photo, width }: { photo: RidePhoto; width: number }) {
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const composedScale = Animated.multiply(baseScale, pinchScale);

  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      lastScale.current = Math.min(Math.max(lastScale.current * event.nativeEvent.scale, 1), 4);
      baseScale.setValue(lastScale.current);
      pinchScale.setValue(1);
    }
  };

  return (
    <View style={[galleryStyles.page, { width }]}>
      <PinchGestureHandler
        onGestureEvent={onPinchGestureEvent}
        onHandlerStateChange={onPinchStateChange}
      >
        <Animated.View style={galleryStyles.zoomContainer}>
          <Animated.Image
            source={{ uri: photo.imageUrl }}
            style={[galleryStyles.image, { transform: [{ scale: composedScale }] }]}
            resizeMode="contain"
          />
        </Animated.View>
      </PinchGestureHandler>
    </View>
  );
}

const galleryStyles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: colors.textTertiary,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: colors.textTertiary,
    fontSize: 13,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  gridContent: {
    alignSelf: 'center',
  },
  photoItem: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  photoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  photoErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  gridList: {
    width: '100%',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoImageLoading: {
    opacity: 0,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
  },
  emptyButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  libraryModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  libraryHeader: {
    minHeight: 72,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'flex-end',
  },
  libraryTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  libraryClose: {
    position: 'absolute',
    right: 16,
    bottom: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  libraryGrid: {
    padding: 3,
  },
  libraryAsset: {
    width: '33.333%',
    aspectRatio: 1,
    padding: 3,
  },
  libraryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.surface,
  },
  libraryEmpty: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.56)',
  },
  uploadText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  modalClose: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalDelete: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalImage: {
    width: '100%',
    height: '70%',
  },
  modalInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    alignItems: 'center',
  },
  modalCounter: {
    color: colors.textTertiary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalAuthor: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalDate: {
    color: colors.textTertiary,
    fontSize: 14,
  },
});
