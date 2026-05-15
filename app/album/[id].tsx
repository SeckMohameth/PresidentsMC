import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Dimensions, Modal } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, X, Camera, Plus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useCrew, useRide } from '@/providers/CrewProvider';
import { formatDate, formatRelativeTime } from '@/utils/helpers';
import { RidePhoto } from '@/types';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 32 - 8) / 3;

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addPhoto } = useCrew();
  const { ride } = useRide(id || '');
  const [selectedPhoto, setSelectedPhoto] = useState<RidePhoto | null>(null);

  if (!ride) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Album not found</Text>
      </View>
    );
  }

  const handleAddPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      addPhoto({ rideId: ride.id, imageUrl: result.assets[0].uri });
    }
  };

  const renderPhoto = ({ item, index }: { item: RidePhoto; index: number }) => (
    <Pressable 
      style={[
        styles.photoItem, 
        { 
          marginRight: (index + 1) % 3 === 0 ? 0 : 4,
          marginBottom: 4,
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
          <ArrowLeft size={24} color={Colors.dark.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{ride.title}</Text>
          <Text style={styles.headerSubtitle}>{formatDate(ride.dateTime)} • {ride.photos.length} photos</Text>
        </View>
        <Pressable style={styles.addButton} onPress={handleAddPhoto}>
          <Plus size={20} color={Colors.dark.text} />
        </Pressable>
      </View>

      {ride.photos.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Camera size={48} color={Colors.dark.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>No Photos Yet</Text>
          <Text style={styles.emptyDescription}>
            Be the first to add photos from this ride!
          </Text>
          <Pressable style={styles.emptyButton} onPress={handleAddPhoto}>
            <Plus size={18} color={Colors.dark.text} />
            <Text style={styles.emptyButtonText}>Add Photos</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={ride.photos}
          renderItem={renderPhoto}
          keyExtractor={item => item.id}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
        />
      )}

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
            <X size={24} color={Colors.dark.text} />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: Colors.dark.textTertiary,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
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
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: Colors.dark.textTertiary,
    fontSize: 13,
    marginTop: 2,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: {
    padding: 16,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.dark.surface,
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
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalDate: {
    color: Colors.dark.textTertiary,
    fontSize: 14,
  },
});
