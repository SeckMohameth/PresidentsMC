import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/utils/firebase';

let notificationHandlerReady = false;

function logNotificationDebug(message: string, error?: unknown) {
  if (__DEV__) {
    console.log(message, error ?? '');
  }
}

function isAndroidExpoGo() {
  return Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient';
}

export async function setupNotificationHandler() {
  if (notificationHandlerReady) return;
  if (isAndroidExpoGo()) return;

  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    notificationHandlerReady = true;
  } catch (error) {
    logNotificationDebug('[Notifications] Handler setup failed', error);
  }
}

export async function registerForPushNotificationsAsync(
  userId: string,
  options: { requestPermission?: boolean } = {}
) {
  const shouldRequestPermission = options.requestPermission !== false;

  if (!Device.isDevice) {
    logNotificationDebug('[Notifications] Must use physical device for push notifications');
    return null;
  }

  if (isAndroidExpoGo()) {
    logNotificationDebug('[Notifications] Android remote push is unavailable in Expo Go. Use a development build.');
    return null;
  }

  const Notifications = await import('expo-notifications');
  await setupNotificationHandler();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    if (!shouldRequestPermission) return null;
    const request = await Notifications.requestPermissionsAsync();
    status = request.status;
  }
  if (status !== 'granted') {
    logNotificationDebug('[Notifications] Permission not granted');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) {
    logNotificationDebug('[Notifications] Missing EAS projectId');
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  await setDoc(
    doc(db, 'users', userId, 'pushTokens', token),
    {
      token,
      platform: Platform.OS,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return token;
}
