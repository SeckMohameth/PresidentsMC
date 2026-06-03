import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, X, Camera, Plus } from 'lucide-react-native';
import { AppColors, useThemeColors } from '@/constants/colors';
import { useCrew, useRide } from '@/providers/CrewProvider';
import { formatDate, formatRelativeTime } from '@/utils/helpers';
import { RidePhoto } from '@/types';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { addPhoto, addAlbumPhoto, getAlbumById } = useCrew();
  const { ride } = useRide(id || '');
  const album = getAlbumById(id || '');
  const [selectedPhoto, setSelectedPhoto] = useState<RidePhoto | null>(null);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [libraryAssets, setLibraryAssets] = useState<MediaLibrary.Asset[]>([]);
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

  if (!ride && !album) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Album not found</Text>
      </View>
    );
  }

  const handleAddPhoto = async () => {
    if (isAddingPhoto || isLoadingLibrary) return;

    setIsLoadingLibrary(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo permissions to add album photos.');
        return;
      }

      const result = await MediaLibrary.getAssetsAsync({
        first: 90,
        mediaType: 'photo',
        sortBy: [['creationTime', false]],
      });

      setLibraryAssets(result.assets);
      setIsLibraryOpen(true);
    } catch (error) {
      if (__DEV__) {
        console.log('[Album] Photo library error:', error);
      }
      Alert.alert('Photo Error', 'Unable to open your photo library right now.');
    } finally {
      setIsLoadingLibrary(false);
    }
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

  const renderPhoto = ({ item, index }: { item: RidePhoto; index: number }) => (
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
      onPress={() => setSelectedPhoto(item)}
    >
      <Image 
        source={{ uri: item.imageUrl }}
        style={styles.photoImage}
        contentFit="cover"
      />
    </Pressable>
  );

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
        <Pressable
          style={[styles.addButton, (isAddingPhoto || isLoadingLibrary) && styles.disabledButton]}
          onPress={handleAddPhoto}
          disabled={isAddingPhoto || isLoadingLibrary}
        >
          {isLoadingLibrary ? <ActivityIndicator color={colors.onPrimary} /> : <Plus size={20} color={colors.onPrimary} />}
        </Pressable>
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
        visible={!!selectedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhoto(null)}
      >
        <View style={styles.modalContainer}>
          <Pressable 
            style={[styles.modalClose, { top: insets.top + 16 }]}
            onPress={() => setSelectedPhoto(null)}
          >
            <X size={24} color={colors.text} />
          </Pressable>
          {selectedPhoto && (
            <>
              <Image 
                source={{ uri: selectedPhoto.imageUrl }}
                style={styles.modalImage}
                contentFit="contain"
              />
              <View style={[styles.modalInfo, { paddingBottom: insets.bottom + 20 }]}>
                <Text style={styles.modalAuthor}>{selectedPhoto.uploadedByName}</Text>
                <Text style={styles.modalDate}>{formatRelativeTime(selectedPhoto.uploadedAt)}</Text>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

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
  gridList: {
    width: '100%',
  },
  photoImage: {
    width: '100%',
    height: '100%',
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
