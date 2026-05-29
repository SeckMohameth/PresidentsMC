import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { setupNotificationHandler } from '@/utils/notifications';

export async function getDevicePushToken() {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  if (Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient') {
    if (__DEV__) {
      console.log('[PushNotifications] Android remote push is unavailable in Expo Go. Use a development build.');
    }
    return null;
  }

  const Notifications = await import('expo-notifications');
  await setupNotificationHandler();

  const existing = await Notifications.getPermissionsAsync();
  if (existing.status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  if (!projectId) {
    if (__DEV__) {
      console.log('[PushNotifications] Missing EAS projectId');
    }
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });

  return token.data;
}
