import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';

export async function requestPhotoLibraryAccess(permissionMessage: string) {
  if (Platform.OS === 'web') return true;

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', permissionMessage);
    return false;
  }

  return true;
}

export async function pickSingleImage(options?: Pick<ImagePicker.ImagePickerOptions, 'quality'>) {
  await ensureImagePickerDirectories();

  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: Platform.OS === 'ios' ? 1 : options?.quality ?? 0.8,
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
  });
}

async function ensureImagePickerDirectories() {
  if (Platform.OS === 'web') return;

  const directories = [
    FileSystem.cacheDirectory,
    FileSystem.documentDirectory,
    FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}ImagePicker` : null,
  ].filter(Boolean);

  await Promise.all(
    directories.map((directory) =>
      FileSystem.makeDirectoryAsync(directory as string, { intermediates: true }).catch(() => {})
    )
  );
}

export function getPhotoPickerErrorMessage(error: unknown) {
  if (!__DEV__) return 'Unable to open this photo. Please choose another image.';

  const details =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message)
        : String(error);

  return `Unable to open this photo. Please choose another image.\n\nDev details: ${details}`;
}
