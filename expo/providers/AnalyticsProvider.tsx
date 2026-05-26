import { useEffect, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '@/providers/AuthProvider';
import { flushAnalyticsEvents, trackAnalyticsEvent, trackScreenView } from '@/utils/analytics';

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const lastPathRef = useRef<string | null>(null);
  const hasTrackedOpenRef = useRef(false);

  useEffect(() => {
    if (hasTrackedOpenRef.current) return;
    hasTrackedOpenRef.current = true;
    void trackAnalyticsEvent({
      eventName: 'app_open',
      actorUserId: user?.id ?? null,
      crewId: user?.crewId ?? null,
      route: pathname ?? null,
      properties: {
        authState: user?.id ? 'authenticated' : 'unauthenticated',
      },
    });
  }, [pathname, user?.crewId, user?.id]);

  useEffect(() => {
    if (!pathname || lastPathRef.current === pathname) return;
    lastPathRef.current = pathname;
    void trackScreenView(pathname, user?.id ?? null, user?.crewId ?? null);
  }, [pathname, user?.crewId, user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        void flushAnalyticsEvents();
      }
    });

    return () => {
      subscription.remove();
      void flushAnalyticsEvents();
    };
  }, []);

  return <>{children}</>;
}
