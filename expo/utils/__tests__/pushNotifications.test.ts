import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { getDevicePushToken } from '@/utils/pushNotifications';

jest.mock('expo-device', () => ({ isDevice: true }));

// Pulled in transitively via @/utils/notifications; never let the real ESM build load.
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), setDoc: jest.fn() }));

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
  setNotificationChannelAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  AndroidImportance: { MAX: 5, DEFAULT: 3 },
}));

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

beforeEach(() => {
  setPlatform('ios');
  (Device as { isDevice: boolean }).isDevice = true;
  (Constants as any).executionEnvironment = 'standalone';
  (Constants as any).easConfig = { projectId: 'eas-project-id' };
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({ data: 'ExponentPushToken[xyz]' });
});

describe('getDevicePushToken', () => {
  it('returns the Expo push token on a granted physical device', async () => {
    await expect(getDevicePushToken()).resolves.toBe('ExponentPushToken[xyz]');
  });

  it('returns null on web and simulators', async () => {
    setPlatform('web');
    await expect(getDevicePushToken()).resolves.toBeNull();

    setPlatform('ios');
    (Device as { isDevice: boolean }).isDevice = false;
    await expect(getDevicePushToken()).resolves.toBeNull();
  });

  it('returns null in Android Expo Go', async () => {
    setPlatform('android');
    (Constants as any).executionEnvironment = 'storeClient';
    await expect(getDevicePushToken()).resolves.toBeNull();
  });

  it('never prompts — silently returns null without permission', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    await expect(getDevicePushToken()).resolves.toBeNull();
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('returns null when the EAS projectId is missing', async () => {
    (Constants as any).easConfig = null;
    (Constants as any).expoConfig = null;
    const saved = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    try {
      await expect(getDevicePushToken()).resolves.toBeNull();
    } finally {
      if (saved !== undefined) process.env.EXPO_PUBLIC_EAS_PROJECT_ID = saved;
    }
  });
});
