import Constants from 'expo-constants';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import { functions } from '@/utils/firebase';
import SafeAsyncStorage from '@/utils/safeAsyncStorage';
import type { AnalyticsEventInput, AnalyticsEventRecord, AnalyticsProperties } from '@/types/analytics';

const ANALYTICS_INSTALLATION_ID_KEY = 'analytics_installation_id';
const SESSION_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const MAX_BATCH_SIZE = 20;
const FLUSH_DELAY_MS = 1200;

type AnalyticsPayload = AnalyticsEventRecord & { properties: AnalyticsProperties };

let installationIdPromise: Promise<string> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;
let isAnalyticsDisabled = false;
let hasLoggedMissingFunction = false;
const queuedEvents: AnalyticsPayload[] = [];

function logAnalyticsDebug(message: string, error?: unknown) {
  if (__DEV__) {
    console.log(message, error ?? '');
  }
}

function getAppVersion() {
  return (
    Constants.expoConfig?.version ??
    Constants.manifest?.version ??
    null
  );
}

function getBuildNumber() {
  return (
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    null
  );
}

async function getInstallationId() {
  if (!installationIdPromise) {
    installationIdPromise = (async () => {
      const existing = await SafeAsyncStorage.getItem(ANALYTICS_INSTALLATION_ID_KEY);
      if (existing) return existing;

      const generated = `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      await SafeAsyncStorage.setItem(ANALYTICS_INSTALLATION_ID_KEY, generated);
      return generated;
    })();
  }

  return installationIdPromise;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAnalyticsEvents();
  }, FLUSH_DELAY_MS);
}

function normalizeProperties(properties?: AnalyticsProperties): AnalyticsProperties {
  if (!properties) return {};
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  );
}

export async function trackAnalyticsEvent(input: AnalyticsEventInput) {
  if (isAnalyticsDisabled) return;

  const installationId = await getInstallationId();
  const event: AnalyticsPayload = {
    id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`,
    sessionId: SESSION_ID,
    installationId,
    platform: (Platform.OS === 'web' ? 'web' : Platform.OS) as AnalyticsPayload['platform'],
    appVersion: getAppVersion(),
    buildNumber: getBuildNumber(),
    clientTimestamp: new Date().toISOString(),
    eventName: input.eventName,
    actorUserId: input.actorUserId ?? null,
    crewId: input.crewId ?? null,
    route: input.route ?? null,
    properties: normalizeProperties(input.properties),
  };

  queuedEvents.push(event);
  if (queuedEvents.length >= MAX_BATCH_SIZE) {
    void flushAnalyticsEvents();
    return;
  }

  scheduleFlush();
}

export async function flushAnalyticsEvents() {
  if (isAnalyticsDisabled || isFlushing || queuedEvents.length === 0) return;
  isFlushing = true;

  const batch = queuedEvents.splice(0, MAX_BATCH_SIZE);
  try {
    const callable = httpsCallable(functions, 'recordAnalyticsEvents');
    await callable({ events: batch });
  } catch (error: any) {
    const errorCode = String(error?.code ?? '');
    const errorMessage = String(error?.message ?? '');
    const isMissingFunction =
      errorCode === 'functions/not-found' ||
      errorCode === 'not-found' ||
      errorMessage.includes('not-found');

    if (isMissingFunction) {
      isAnalyticsDisabled = true;
      if (!hasLoggedMissingFunction) {
        hasLoggedMissingFunction = true;
        logAnalyticsDebug(
          '[Analytics] recordAnalyticsEvents is not deployed yet. Client analytics disabled until functions are deployed.'
        );
      }
      return;
    }

    logAnalyticsDebug('[Analytics] Flush error:', error);
    queuedEvents.unshift(...batch);
  } finally {
    isFlushing = false;
    if (!isAnalyticsDisabled && queuedEvents.length > 0) {
      scheduleFlush();
    }
  }
}

export async function trackScreenView(route: string, actorUserId?: string | null, crewId?: string | null) {
  await trackAnalyticsEvent({
    eventName: 'screen_view',
    route,
    actorUserId: actorUserId ?? null,
    crewId: crewId ?? null,
    properties: { route },
  });
}
