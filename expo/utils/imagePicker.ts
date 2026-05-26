import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

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

export async function pickSingleImage(_options?: Pick<ImagePicker.ImagePickerOptions, 'quality'>): Promise<PickedImageResult> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
  });
  return normalizeImagePickerResult(result);
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
