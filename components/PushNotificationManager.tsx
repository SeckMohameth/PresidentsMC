import { useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { registerForPushNotificationsAsync } from '@/utils/notifications';

export default function PushNotificationManager() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    if (user.preferences?.pushEnabled === false) return;
    registerForPushNotificationsAsync(user.id).catch((error) => {
      if (__DEV__) {
        console.log('[PushNotificationManager] Register error:', error);
      }
    });
  }, [user?.id, user?.preferences?.pushEnabled]);

  return null;
}
