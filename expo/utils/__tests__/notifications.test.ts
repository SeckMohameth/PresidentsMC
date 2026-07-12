import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { doc, setDoc } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '@/utils/notifications';

jest.mock('expo-device', () => ({ isDevice: true }));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    executionEnvironment: 'standalone',
    easConfig: { projectId: 'eas-project-id' },
    expoConfig: { extra: { eas: { projectId: 'eas-project-id' } } },
  },
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  AndroidImportance: { MAX: 5, DEFAULT: 3 },
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  setDoc: jest.fn(async () => undefined),
}));

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

function setDevice(isDevice: boolean) {
  (Device as { isDevice: boolean }).isDevice = isDevice;
}

beforeEach(() => {
  setPlatform('ios');
  setDevice(true);
  (Constants as any).executionEnvironment = 'standalone';
  (Constants as any).easConfig = { projectId: 'eas-project-id' };
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExponentPushToken[abc]' });
});

describe('registerForPushNotificationsAsync', () => {
  it('returns null on simulators without touching permissions', async () => {
    setDevice(false);
    await expect(registerForPushNotificationsAsync('user-1')).resolves.toBeNull();
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('returns null in Android Expo Go, where remote push was removed', async () => {
    setPlatform('android');
    (Constants as any).executionEnvironment = 'storeClient';
    await expect(registerForPushNotificationsAsync('user-1')).resolves.toBeNull();
    expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('registers the token and stores it under the user with merge semantics', async () => {
    await expect(registerForPushNotificationsAsync('user-1')).resolves.toBe('ExponentPushToken[abc]');
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'eas-project-id' });
    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      'users',
      'user-1',
      'pushTokens',
      'ExponentPushToken[abc]'
    );
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ token: 'ExponentPushToken[abc]', platform: 'ios' }),
      { merge: true }
    );
  });

  it('does not prompt when the caller only wants the silent path', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    await expect(
      registerForPushNotificationsAsync('user-1', { requestPermission: false })
    ).resolves.toBeNull();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('prompts when needed and proceeds if the user grants', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    await expect(registerForPushNotificationsAsync('user-1')).resolves.toBe('ExponentPushToken[abc]');
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('returns null when the user denies the prompt', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    await expect(registerForPushNotificationsAsync('user-1')).resolves.toBeNull();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('creates the Android notification channel on Android only', async () => {
    setPlatform('android');
    await registerForPushNotificationsAsync('user-1');
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ importance: 5 })
    );

    (Notifications.setNotificationChannelAsync as jest.Mock).mockClear();
    setPlatform('ios');
    await registerForPushNotificationsAsync('user-1');
    expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('returns null when no EAS projectId can be resolved', async () => {
    (Constants as any).easConfig = null;
    (Constants as any).expoConfig = null;
    const saved = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    try {
      await expect(registerForPushNotificationsAsync('user-1')).resolves.toBeNull();
      expect(setDoc).not.toHaveBeenCalled();
    } finally {
      if (saved !== undefined) process.env.EXPO_PUBLIC_EAS_PROJECT_ID = saved;
    }
  });
});
