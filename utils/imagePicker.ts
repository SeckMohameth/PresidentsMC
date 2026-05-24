import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

type PickedImageResult = {
  canceled: boolean;
  assets: Array<{
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
    width?: number;
    height?: number;
  }>;
};

export async function requestPhotoLibraryAccess(permissionMessage: string) {
  if (Platform.OS === 'web') return true;

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', permissionMessage);
    return false;
  }

  return true;
}

export async function pickSingleImage(options?: Pick<ImagePicker.ImagePickerOptions, 'quality'>): Promise<PickedImageResult> {
  await ensureImagePickerDirectories();

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: Platform.OS === 'ios' ? 1 : options?.quality ?? 0.8,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });
    return normalizeImagePickerResult(result);
  } catch (error) {
    if (Platform.OS !== 'ios' || !isLocalPickerWriteError(error)) {
      throw error;
    }

    if (__DEV__) {
      console.log('[ImagePicker] Native photo picker failed; falling back to document picker.', error);
    }
    return pickImageFile();
  }
}

function normalizeImagePickerResult(result: ImagePicker.ImagePickerResult): PickedImageResult {
  if (result.canceled) {
    return { canceled: true, assets: [] };
  }

  return {
    canceled: false,
    assets: result.assets.map((asset) => ({
      uri: asset.uri,
      fileName: asset.fileName,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
    })),
  };
}

async function pickImageFile(): Promise<PickedImageResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'image/*',
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return { canceled: true, assets: [] };
  }

  const asset = result.assets[0];
  return {
    canceled: false,
    assets: [{
      uri: asset.uri,
      fileName: asset.name,
      mimeType: asset.mimeType,
      width: undefined,
      height: undefined,
    }],
  };
}

function isLocalPickerWriteError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message)
        : String(error);

  return message.includes('Failed to write data to a file')
    || message.includes("doesn't exist")
    || message.includes('does not exist');
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
