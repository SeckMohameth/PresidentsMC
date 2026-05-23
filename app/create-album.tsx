import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { AppColors, useThemeColors } from '@/constants/colors';
import { useCrew } from '@/providers/CrewProvider';
import { getPhotoPickerErrorMessage, pickSingleImage, requestPhotoLibraryAccess } from '@/utils/imagePicker';

export default function CreateAlbumScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const { createAlbum } = useCrew();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const pickCoverImage = async () => {
    const hasAccess = await requestPhotoLibraryAccess(
      'Please grant photo permissions to select an album cover.'
    );
    if (!hasAccess) return;

    try {
      const result = await pickSingleImage({ quality: 0.8 });

      if (!result.canceled && result.assets[0]) {
        setCoverImage(result.assets[0].uri);
      }
    } catch (error) {
      if (__DEV__) {
        console.log('[CreateAlbum] Photo picker error:', error);
      }
      Alert.alert('Photo Error', getPhotoPickerErrorMessage(error));
    }
  };

  const saveAlbum = async () => {
    if (!title.trim()) {
      Alert.alert('Album title', 'Enter a title for this album.');
      return;
    }

    setIsSaving(true);
    try {
      const albumId = await createAlbum({
        title,
        description,
        coverImage,
      });
      router.replace(`/album/${albumId}`);
    } catch (error: any) {
      const message =
        error?.message === 'NOT_AUTHORIZED'
          ? 'You do not have permission to create albums.'
          : 'Unable to create this album right now.';
      Alert.alert('Error', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <X size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>New Album</Text>
        <Pressable
          style={[styles.saveButton, (!title.trim() || isSaving) && styles.saveButtonDisabled]}
          onPress={saveAlbum}
          disabled={!title.trim() || isSaving}
        >
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Create'}</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.coverPicker} onPress={pickCoverImage}>
            {coverImage ? (
              <>
                <Image source={{ uri: coverImage }} style={styles.coverImage} contentFit="cover" />
                <View style={styles.coverOverlay}>
                  <ImagePlus size={22} color="#FFFFFF" />
                </View>
              </>
            ) : (
              <View style={styles.coverPlaceholder}>
                <Camera size={32} color={colors.textTertiary} />
                <Text style={styles.coverPlaceholderText}>Album cover</Text>
              </View>
            )}
          </Pressable>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Club picnic, bike night, charity run..."
            placeholderTextColor={colors.textTertiary}
            maxLength={80}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Optional notes for this album"
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={500}
          />
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
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  saveButton: {
    height: 40,
    minWidth: 78,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveButtonText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 20,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: 10,
  },
  coverPicker: {
    height: 220,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  coverPlaceholderText: {
    color: colors.textTertiary,
    fontSize: 14,
    fontWeight: '700',
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 10,
  },
  input: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  textArea: {
    minHeight: 118,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
});
