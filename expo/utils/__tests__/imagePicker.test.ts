import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  getPhotoPickerErrorMessage,
  pickSingleImage,
  requestPhotoLibraryAccess,
} from '@/utils/imagePicker';

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

afterEach(() => setPlatform('ios'));

describe('requestPhotoLibraryAccess', () => {
  it('always allows on web without asking', async () => {
    setPlatform('web');
    await expect(requestPhotoLibraryAccess('msg')).resolves.toBe(true);
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns true when permission is granted', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await expect(requestPhotoLibraryAccess('msg')).resolves.toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });

  it('alerts with the caller-provided message when denied', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await expect(requestPhotoLibraryAccess('We need your photos for ride albums.')).resolves.toBe(false);
    expect(alert).toHaveBeenCalledWith('Permission needed', 'We need your photos for ride albums.');
  });
});

describe('pickSingleImage', () => {
  it('asks for a single image with a default quality of 0.85', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
    await pickSingleImage();
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.85,
    });
  });

  it('honors a caller-supplied quality', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
    await pickSingleImage({ quality: 0.5 });
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 0.5 })
    );
  });

  it('normalizes a cancelled picker to an empty asset list', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true });
    await expect(pickSingleImage()).resolves.toEqual({ canceled: true, assets: [] });
  });

  it('keeps only the fields the app consumes from picked assets', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///tmp/a.jpg',
          fileName: 'a.jpg',
          mimeType: 'image/jpeg',
          width: 100,
          height: 50,
          exif: { GPSLatitude: 40.7 }, // must NOT leak through
          base64: 'xxxx',
        },
      ],
    });
    await expect(pickSingleImage()).resolves.toEqual({
      canceled: false,
      assets: [
        { uri: 'file:///tmp/a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg', width: 100, height: 50 },
      ],
    });
  });
});

describe('getPhotoPickerErrorMessage', () => {
  it('keeps the user-facing sentence first and appends dev details in __DEV__', () => {
    const message = getPhotoPickerErrorMessage(new Error('ph:// asset failed'));
    expect(message).toContain('Unable to open this photo.');
    expect(message).toContain('ph:// asset failed');
  });

  it('stringifies non-Error values safely', () => {
    expect(getPhotoPickerErrorMessage({ message: 'obj message' })).toContain('obj message');
    expect(getPhotoPickerErrorMessage('plain string')).toContain('plain string');
  });
});
