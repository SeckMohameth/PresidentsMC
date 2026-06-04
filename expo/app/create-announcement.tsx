import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform, Switch, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Pin, ImagePlus, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { AppColors, useThemeColors } from '@/constants/colors';
import { useCrew } from '@/providers/CrewProvider';
import { ImageAttribution } from '@/types';
import { getPhotoPickerErrorMessage, pickSingleImage, requestPhotoLibraryAccess } from '@/utils/imagePicker';
import {
  COVER_IMAGE_PRESETS,
  getCoverImageSource,
  getCoverPresetReference,
  normalizeCoverImageReference,
} from '@/constants/coverImages';

function getAnnouncementSaveErrorMessage(error: unknown, action: 'post' | 'save') {
  const code = String((error as any)?.code ?? '');
  const message =
    error instanceof Error && error.message
      ? error.message
      : String((error as any)?.message ?? '');
  const devDetails = __DEV__ && message ? `\n\nDev details${code ? ` (${code})` : ''}: ${message}` : '';

  if (
    code === 'storage/unauthorized' ||
    code === 'permission-denied' ||
    message.includes('storage/unauthorized') ||
    message.includes('permission-denied') ||
    message.includes('NOT_AUTHORIZED')
  ) {
    return `Your account does not have permission to ${action} announcements yet. If you were just promoted, close and reopen the app, then try again.${devDetails}`;
  }

  if (
    message.includes('Unable to read selected image') ||
    message.includes('FileSystem') ||
    message.includes('MediaLibrary')
  ) {
    return `Unable to read the selected image. Expo Go has limited media-library access on Android, so test image uploads in a development build or choose another image.${devDetails}`;
  }

  return `Unable to ${action} this announcement right now.${devDetails}`;
}

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
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

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
        <Text style={{ color: colors.textSecondary }}>Loading announcement...</Text>
      </View>
    );
  }

  const pickImage = async () => {
    const hasAccess = await requestPhotoLibraryAccess(
      'Please grant camera roll permissions to upload images.'
    );
    if (!hasAccess) return;

    try {
      const result = await pickSingleImage({ quality: 0.8 });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setImageAttribution(undefined);
        if (Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.log('[CreateAnnouncement] Photo picker error:', error);
      }
      Alert.alert('Photo Error', getPhotoPickerErrorMessage(error));
    }
  };

  const removeImage = () => {
    setImageUri(null);
    setImageAttribution(undefined);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const selectPresetImage = (presetReference: string) => {
    setImageUri(presetReference);
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
          imageUrl: imageUri ? normalizeCoverImageReference(imageUri) : null,
          imageAttribution: imageUri ? imageAttribution : null,
        });
        router.back();
      } catch (error: any) {
        const message =
          error?.message === 'SUBSCRIPTION_INACTIVE'
            ? 'Subscription inactive. Renew to update announcements.'
            : getAnnouncementSaveErrorMessage(error, 'save');
        Alert.alert('Error', message);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIsCreating(true);

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    try {
      await createAnnouncement({
        crewId: crew?.id || '',
        authorId: currentUser?.id || '',
        authorName: currentUser?.name || '',
        authorAvatar: currentUser?.avatar || '',
        authorRole: currentUser?.role || 'member',
        title: title.trim(),
        content: content.trim(),
        link: normalizeLink(link),
        isPinned,
        imageUrl: imageUri ? normalizeCoverImageReference(imageUri) : undefined,
        imageAttribution,
      });

      router.back();
    } catch (error: any) {
      const message =
        error?.message === 'SUBSCRIPTION_INACTIVE'
          ? 'Subscription inactive. Renew to post announcements.'
          : getAnnouncementSaveErrorMessage(error, 'post');
      Alert.alert('Error', message);
    } finally {
      setIsCreating(false);
    }
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
          <X size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Announcement' : 'New Announcement'}</Text>
        <View style={styles.headerActions}>
          {isEditMode && (
            <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={isSaving}>
              <Trash2 size={17} color={colors.error} />
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
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Content *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write your announcement..."
              placeholderTextColor={colors.textTertiary}
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
              placeholderTextColor={colors.textTertiary}
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
                  source={getCoverImageSource(imageUri)}
                  style={styles.imagePreview}
                  contentFit="cover"
                />
                <Pressable style={styles.removeImageButton} onPress={removeImage}>
                  <X size={18} color="#FFFFFF" />
                  <Text style={styles.removeImageText}>Remove</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.imagePickerButton} onPress={pickImage}>
                <ImagePlus size={24} color={colors.textTertiary} />
                <Text style={styles.imagePickerText}>Add from Photos</Text>
              </Pressable>
            )}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imagePresetList}
            >
              {COVER_IMAGE_PRESETS.map((preset) => {
                const presetReference = getCoverPresetReference(preset);
                const selected = imageUri === presetReference;
                return (
                  <Pressable
                    key={preset.id}
                    style={[styles.imagePreset, selected && styles.imagePresetSelected]}
                    onPress={() => selectPresetImage(presetReference)}
                  >
                    <Image source={preset.source} style={styles.imagePresetThumb} contentFit="cover" />
                    <Text style={styles.imagePresetLabel} numberOfLines={1}>
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.optionRow}>
            <View style={styles.optionInfo}>
              <View style={styles.optionIcon}>
                <Pin size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.optionTitle}>Pin Announcement</Text>
                <Text style={styles.optionDescription}>Keep this at the top of the feed</Text>
              </View>
            </View>
            <Switch
              value={isPinned}
              onValueChange={setIsPinned}
              trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
              thumbColor={colors.text}
            />
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              This announcement will be visible to all crew members. Only authorized club leaders can post announcements.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  createButtonDisabled: {
    backgroundColor: colors.surfaceElevated,
  },
  createButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  createButtonTextDisabled: {
    color: colors.textTertiary,
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
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionDescription: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  imagePickerButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: 8,
  },
  imagePickerGroup: {
    gap: 12,
  },
  imagePickerText: {
    color: colors.textTertiary,
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
  imagePresetList: {
    gap: 10,
    paddingTop: 12,
    paddingRight: 4,
  },
  imagePreset: {
    width: 104,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  imagePresetSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  imagePresetThumb: {
    width: '100%',
    height: 68,
  },
  imagePresetLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 36,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeImageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
