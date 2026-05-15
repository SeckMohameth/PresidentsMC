import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, Switch, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { X, Pin, ImagePlus, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useCrew } from '@/providers/CrewProvider';
import UnsplashPicker, { UnsplashSelection } from '@/components/UnsplashPicker';
import { ImageAttribution } from '@/types';

export default function CreateAnnouncementScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { announcementId } = useLocalSearchParams<{ announcementId?: string }>();
  const { crew, currentUser, createAnnouncement, updateAnnouncement, deleteAnnouncement, getAnnouncementById } = useCrew();
  const announcement = announcementId ? getAnnouncementById(announcementId) : undefined;
  const isEditMode = Boolean(announcementId);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [link, setLink] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageAttribution, setImageAttribution] = useState<ImageAttribution | undefined>();
  const [showUnsplash, setShowUnsplash] = useState(false);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  useEffect(() => {
    if (!announcement || !isEditMode) return;
    setTitle(announcement.title);
    setContent(announcement.content);
    setLink(announcement.link || '');
    setIsPinned(announcement.isPinned);
    setImageUri(announcement.imageUrl || null);
    setImageAttribution(announcement.imageAttribution);
  }, [announcement, isEditMode]);

  if (isEditMode && !announcement) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: Colors.dark.textSecondary }}>Loading announcement...</Text>
      </View>
    );
  }

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageAttribution(undefined);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handleUnsplashSelect = (selection: UnsplashSelection) => {
    setImageUri(selection.url);
    setImageAttribution(selection.attribution);
    setShowUnsplash(false);
  };

  const removeImage = () => {
    setImageUri(null);
    setImageAttribution(undefined);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const normalizeLink = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return `https://${trimmed}`;
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Error', 'Please enter content');
      return;
    }

    if (isEditMode && announcementId) {
      setIsSaving(true);
      try {
        await updateAnnouncement(announcementId, {
          title: title.trim(),
          content: content.trim(),
          link: normalizeLink(link),
          isPinned,
          imageUrl: imageUri ?? null,
          imageAttribution: imageUri ? imageAttribution : null,
        });
        router.back();
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIsCreating(true);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    createAnnouncement({
      crewId: crew?.id || '',
      authorId: currentUser?.id || '',
      authorName: currentUser?.name || '',
      authorAvatar: currentUser?.avatar || '',
      authorRole: currentUser?.role || 'member',
      title: title.trim(),
      content: content.trim(),
      link: normalizeLink(link),
      isPinned,
      imageUrl: imageUri || undefined,
      imageAttribution: imageAttribution,
    });

    router.back();
  };

  const handleDelete = () => {
    if (!announcementId) return;
    Alert.alert('Delete Announcement', 'Remove this announcement from the club feed?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setIsSaving(true);
          try {
            await deleteAnnouncement(announcementId);
            router.back();
          } catch {
            Alert.alert('Error', 'Unable to delete this announcement right now.');
          } finally {
            setIsSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <X size={24} color={Colors.dark.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Announcement' : 'New Announcement'}</Text>
        <View style={styles.headerActions}>
          {isEditMode && (
            <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={isSaving}>
              <Trash2 size={17} color={Colors.dark.error} />
            </Pressable>
          )}
          <Pressable
            style={[styles.createButton, (!title.trim() || !content.trim() || isCreating || isSaving) && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={!title.trim() || !content.trim() || isCreating || isSaving}
          >
            <Text style={[styles.createButtonText, (!title.trim() || !content.trim() || isCreating || isSaving) && styles.createButtonTextDisabled]}>
              {isSaving ? 'Saving...' : isCreating ? 'Posting...' : isEditMode ? 'Save' : 'Post'}
            </Text>
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 20 },
            isTablet && styles.scrollContentTablet,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="What's the announcement about?"
              placeholderTextColor={Colors.dark.textTertiary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Content *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write your announcement..."
              placeholderTextColor={Colors.dark.textTertiary}
              value={content}
              onChangeText={setContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Link (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="https://example.com"
              placeholderTextColor={Colors.dark.textTertiary}
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Image (Optional)</Text>
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image 
                  source={{ uri: imageUri }}
                  style={styles.imagePreview}
                  contentFit="cover"
                />
                <Pressable style={styles.removeImageButton} onPress={removeImage}>
                  <Trash2 size={18} color={Colors.dark.text} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.imagePickerGroup}>
                <Pressable style={styles.imagePickerButton} onPress={pickImage}>
                  <ImagePlus size={24} color={Colors.dark.textTertiary} />
                  <Text style={styles.imagePickerText}>Add from Photos</Text>
                </Pressable>
                <Pressable style={styles.imagePickerButton} onPress={() => setShowUnsplash(true)}>
                  <ImagePlus size={24} color={Colors.dark.textTertiary} />
                  <Text style={styles.imagePickerText}>Choose from Unsplash</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <View style={styles.optionIcon}>
                <Pin size={20} color={Colors.dark.primary} />
              </View>
              <View>
                <Text style={styles.optionTitle}>Pin Announcement</Text>
                <Text style={styles.optionDescription}>Keep this at the top of the feed</Text>
              </View>
            </View>
            <Switch
              value={isPinned}
              onValueChange={setIsPinned}
              trackColor={{ false: Colors.dark.surfaceElevated, true: Colors.dark.primary }}
              thumbColor={Colors.dark.text}
            />
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              This announcement will be visible to all crew members. Only admins and officers can post announcements.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <UnsplashPicker
        visible={showUnsplash}
        onClose={() => setShowUnsplash(false)}
        onSelect={handleUnsplashSelect}
        title="Choose an Image"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
    backgroundColor: Colors.dark.surface,
  },
  createButton: {
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createButtonDisabled: {
    backgroundColor: Colors.dark.surfaceElevated,
  },
  createButtonText: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: '600',
  },
  createButtonTextDisabled: {
    color: Colors.dark.textTertiary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  scrollContentTablet: {
    maxWidth: 840,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    marginBottom: 20,
  },
  label: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.dark.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  textArea: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionDescription: {
    color: Colors.dark.textTertiary,
    fontSize: 13,
  },
  infoCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.primary,
  },
  infoText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  imagePickerButton: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.border,
    borderStyle: 'dashed',
    gap: 8,
  },
  imagePickerGroup: {
    gap: 12,
  },
  imagePickerText: {
    color: Colors.dark.textTertiary,
    fontSize: 14,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
