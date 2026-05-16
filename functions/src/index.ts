import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
} from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  FieldValue,
  getFirestore,
  Timestamp,
  WriteBatch,
} from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

initializeApp();

const adminDb = getFirestore();
const adminAuth = getAuth();
const storage = getStorage();

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const FORMER_MEMBER_NAME = 'Former Member';
const FORMER_MEMBER_AVATAR = '';
const SYSTEM_ACTOR = 'system';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type UserRole = 'admin' | 'officer' | 'member';
type SubscriptionStatus = 'active' | 'inactive' | 'past_due' | 'trialing';

type CrewDoc = {
  id: string;
  name?: string;
  ownerId?: string | null;
  subscriptionOwnerId?: string | null;
  subscriptionStatus?: SubscriptionStatus;
  status?: 'active' | 'archived';
  archivedAt?: string | null;
  purgeAt?: string | null;
  inviteCode?: string;
  requiresApproval?: boolean;
  memberCount?: number;
  totalRides?: number;
  totalMiles?: number;
  totalPhotos?: number;
};

type CrewMemberDoc = {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  bike?: string;
  role?: UserRole;
  leadershipTitle?: string;
  isDeveloperSupport?: boolean;
  joinedCrewAt?: string;
  joinedAt?: string;
  ridesAttended?: number;
  milesTraveled?: number;
};

type UserDoc = {
  id: string;
  email?: string;
  name?: string;
  avatar?: string;
  bike?: string;
  crewId?: string | null;
  role?: UserRole;
  preferences?: Record<string, unknown>;
};

type JoinRequestDoc = {
  id: string;
  crewId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
  status?: 'pending' | 'approved' | 'denied';
  message?: string;
};

type AnnouncementDoc = {
  id?: string;
  title?: string;
  content?: string;
  authorId?: string;
  authorName?: string;
};

type RidePhotoDoc = {
  id?: string;
  uploadedBy?: string;
  uploadedByName?: string;
};

type RideDoc = {
  id?: string;
  title?: string;
  createdBy?: string | null;
  createdByName?: string;
  dateTime?: string;
  attendees?: string[];
  checkedIn?: string[];
  photos?: RidePhotoDoc[];
  status?: string;
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type ExitCrewResult = {
  crewId: string | null;
  crewName: string | null;
  ownershipTransferred: boolean;
  crewArchived: boolean;
  leftAsOwner: boolean;
  shouldManageSubscription: boolean;
  nextOwnerId: string | null;
  nextOwnerName: string | null;
};

type AnalyticsEventInput = {
  id?: string;
  eventName?: string;
  actorUserId?: string | null;
  crewId?: string | null;
  route?: string | null;
  sessionId?: string;
  installationId?: string;
  appVersion?: string | null;
  buildNumber?: string | null;
  platform?: 'ios' | 'android' | 'web' | string;
  clientTimestamp?: string;
  properties?: Record<string, unknown>;
};

const isExpoPushToken = (token: string) =>
  token.startsWith('ExpoPushToken[') || token.startsWith('ExponentPushToken[');

const isActiveSubscription = (status?: SubscriptionStatus | null) =>
  status === 'active' || status === 'trialing';

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

function normalizeIso(value: unknown, fallback = new Date(0).toISOString()) {
  if (!value) return fallback;
  if (typeof value === 'string') return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return fallback;
}

function resolveRideStatus(ride: { status?: string; dateTime?: unknown }) {
  const status = ride.status ?? 'upcoming';
  if (status !== 'upcoming') return status;
  const rideAt = new Date(normalizeIso(ride.dateTime)).getTime();
  if (Number.isNaN(rideAt)) return status;
  return rideAt < Date.now() ? 'completed' : status;
}

function pickNextOwner(members: CrewMemberDoc[], excludeId: string) {
  const candidates = members.filter(
    (member) => member.id !== excludeId && !member.isDeveloperSupport
  );
  if (candidates.length === 0) return null;

  const priority = (role?: UserRole) => {
    if (role === 'admin' || role === 'officer') return 0;
    return 1;
  };

  return [...candidates].sort((a, b) => {
    const roleDiff = priority(a.role) - priority(b.role);
    if (roleDiff !== 0) return roleDiff;
    return (
      new Date(normalizeIso(a.joinedCrewAt || a.joinedAt)).getTime() -
      new Date(normalizeIso(b.joinedCrewAt || b.joinedAt)).getTime()
    );
  })[0];
}

function buildArchiveFields(now = new Date()) {
  const archivedAt = now.toISOString();
  const purgeAt = new Date(now.getTime() + THIRTY_DAYS_MS).toISOString();
  return { archivedAt, purgeAt };
}

function generateInviteCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += INVITE_CODE_CHARS[Math.floor(Math.random() * INVITE_CODE_CHARS.length)];
  }
  return code;
}

function parseRevenueCatPayload(payload: any): { appUserId: string | null; status: SubscriptionStatus } {
  const event = payload?.event ?? payload ?? {};
  const appUserId =
    event.app_user_id ??
    event.appUserId ??
    event.original_app_user_id ??
    payload?.app_user_id ??
    null;
  const eventType = String(event.type ?? payload?.type ?? '').toUpperCase();
  const periodType = String(event.period_type ?? payload?.period_type ?? '').toLowerCase();
  const expirationAtMs = Number(
    event.expiration_at_ms ??
      event.expires_at_ms ??
      payload?.expiration_at_ms ??
      payload?.expires_at_ms ??
      0
  );

  if (eventType === 'BILLING_ISSUE') {
    return { appUserId, status: 'past_due' };
  }

  if (
    [
      'INITIAL_PURCHASE',
      'RENEWAL',
      'UNCANCELLATION',
      'NON_RENEWING_PURCHASE',
      'PRODUCT_CHANGE',
      'TRANSFER',
      'TEMPORARY_ENTITLEMENT_GRANT',
    ].includes(eventType)
  ) {
    return { appUserId, status: periodType === 'trial' ? 'trialing' : 'active' };
  }

  if (eventType === 'CANCELLATION') {
    const isStillActive = expirationAtMs > Date.now();
    return {
      appUserId,
      status: isStillActive ? (periodType === 'trial' ? 'trialing' : 'active') : 'inactive',
    };
  }

  if (['EXPIRATION', 'SUBSCRIPTION_PAUSED'].includes(eventType)) {
    return { appUserId, status: 'inactive' };
  }

  const isStillActive = expirationAtMs > Date.now();
  return {
    appUserId,
    status: isStillActive ? (periodType === 'trial' ? 'trialing' : 'active') : 'inactive',
  };
}

async function sendExpoPush(messages: ExpoPushMessage[]) {
  const valid = messages.filter((msg) => isExpoPushToken(msg.to));
  if (valid.length === 0) return;

  const chunks = chunkArray(valid, 100);
  for (const chunk of chunks) {
    await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    });
  }
}

async function getUserPreferences(userId: string) {
  const snap = await adminDb.collection('users').doc(userId).get();
  return snap.exists ? ((snap.data() as UserDoc).preferences ?? {}) : {};
}

async function getUserPushTokens(userId: string) {
  const snap = await adminDb.collection('users').doc(userId).collection('pushTokens').get();
  return snap.docs.map((docSnap) => docSnap.id);
}

async function getCrewName(crewId: string) {
  const crewSnap = await adminDb.collection('crews').doc(crewId).get();
  return crewSnap.exists ? ((crewSnap.data() as CrewDoc).name ?? 'PresidentsMC') : 'PresidentsMC';
}

async function getCrewMembers(crewId: string) {
  const snap = await adminDb.collection('crews').doc(crewId).collection('members').get();
  return snap.docs.map((docSnap) => ({ ...(docSnap.data() as CrewMemberDoc), id: docSnap.id }));
}

async function getCrewLeaders(crewId: string) {
  const members = await getCrewMembers(crewId);
  return members.filter(
    (member) =>
      !member.isDeveloperSupport &&
      (member.role === 'admin' || member.role === 'officer')
  );
}

async function getMemberName(crewId: string, userId: string) {
  const memberSnap = await adminDb
    .collection('crews')
    .doc(crewId)
    .collection('members')
    .doc(userId)
    .get();
  if (memberSnap.exists) {
    const member = memberSnap.data() as CrewMemberDoc;
    return member.name || 'A member';
  }

  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (userSnap.exists) {
    const user = userSnap.data() as UserDoc;
    return user.name || 'A member';
  }

  return 'A member';
}

async function queueUserPush(
  messages: ExpoPushMessage[],
  userId: string,
  notificationType: 'announcements' | 'rides' | 'joinRequests',
  payload: Omit<ExpoPushMessage, 'to'>
) {
  const prefs = await getUserPreferences(userId);
  if (prefs.pushEnabled === false || prefs[notificationType] === false) return;

  const tokens = await getUserPushTokens(userId);
  tokens.forEach((token) => {
    messages.push({ to: token, ...payload });
  });
}

async function notifyCrewMembers({
  crewId,
  notificationType,
  excludeUserIds = [],
  title,
  body,
  data,
}: {
  crewId: string;
  notificationType: 'announcements' | 'rides' | 'joinRequests';
  excludeUserIds?: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  const exclude = new Set(excludeUserIds.filter(Boolean));
  const members = await getCrewMembers(crewId);
  const messages: ExpoPushMessage[] = [];

  for (const member of members) {
    if (member.isDeveloperSupport || exclude.has(member.id)) continue;
    await queueUserPush(messages, member.id, notificationType, { title, body, data });
  }

  await sendExpoPush(messages);
}

async function notifyCrewLeaders({
  crewId,
  notificationType = 'joinRequests',
  excludeUserIds = [],
  title,
  body,
  data,
}: {
  crewId: string;
  notificationType?: 'announcements' | 'rides' | 'joinRequests';
  excludeUserIds?: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  const exclude = new Set(excludeUserIds.filter(Boolean));
  const leaders = await getCrewLeaders(crewId);
  const messages: ExpoPushMessage[] = [];

  for (const leader of leaders) {
    if (exclude.has(leader.id)) continue;
    await queueUserPush(messages, leader.id, notificationType, { title, body, data });
  }

  await sendExpoPush(messages);
}

async function flushBatch(batch: WriteBatch, operations: number) {
  if (operations === 0) return 0;
  await batch.commit();
  return 0;
}

async function deleteUserPushTokens(userId: string) {
  const tokensSnap = await adminDb.collection('users').doc(userId).collection('pushTokens').get();
  if (tokensSnap.empty) return;

  let batch = adminDb.batch();
  let operations = 0;
  for (const tokenDoc of tokensSnap.docs) {
    batch.delete(tokenDoc.ref);
    operations += 1;
    if (operations === 400) {
      await batch.commit();
      batch = adminDb.batch();
      operations = 0;
    }
  }

  await flushBatch(batch, operations);
}

async function anonymizeUserGeneratedContent(userId: string) {
  const rideSnapshotsPromise = adminDb.collectionGroup('rides').get();
  const announcementSnapshotsPromise = adminDb
    .collectionGroup('announcements')
    .where('authorId', '==', userId)
    .get();
  const joinRequestSnapshotsPromise = adminDb
    .collectionGroup('joinRequests')
    .where('userId', '==', userId)
    .get();

  const [rideSnapshots, announcementSnapshots, joinRequestSnapshots] = await Promise.all([
    rideSnapshotsPromise,
    announcementSnapshotsPromise,
    joinRequestSnapshotsPromise,
  ]);

  let batch = adminDb.batch();
  let operations = 0;

  const queueUpdate = async (ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) => {
    batch.set(ref, data, { merge: true });
    operations += 1;
    if (operations === 400) {
      await batch.commit();
      batch = adminDb.batch();
      operations = 0;
    }
  };

  for (const docSnap of announcementSnapshots.docs) {
    await queueUpdate(docSnap.ref, {
      authorId: null,
      authorName: FORMER_MEMBER_NAME,
      authorAvatar: FORMER_MEMBER_AVATAR,
    });
  }

  for (const docSnap of rideSnapshots.docs) {
    const ride = docSnap.data() as Record<string, any>;
    const photos = Array.isArray(ride.photos) ? ride.photos : [];
    const nextPhotos = photos.map((photo) =>
      photo?.uploadedBy === userId
        ? {
            ...photo,
            uploadedBy: null,
            uploadedByName: FORMER_MEMBER_NAME,
          }
        : photo
    );

    const rideUpdate: Record<string, unknown> = {};
    if (ride.createdBy === userId) {
      rideUpdate.createdBy = null;
      rideUpdate.createdByName = FORMER_MEMBER_NAME;
    }

    if (JSON.stringify(nextPhotos) !== JSON.stringify(photos)) {
      rideUpdate.photos = nextPhotos;
    }

    if (Object.keys(rideUpdate).length > 0) {
      await queueUpdate(docSnap.ref, rideUpdate);
    }
  }

  for (const docSnap of joinRequestSnapshots.docs) {
    await queueUpdate(docSnap.ref, {
      userName: FORMER_MEMBER_NAME,
      userAvatar: FORMER_MEMBER_AVATAR,
      userEmail: '',
    });
  }

  await flushBatch(batch, operations);
}

async function deleteUserStorage(userId: string) {
  try {
    await storage.bucket().deleteFiles({ prefix: `users/${userId}/` });
  } catch (error: any) {
    const message = String(error?.message ?? '');
    if (!message.includes('No such object') && !message.includes('Not Found')) {
      console.log('[Functions] User storage cleanup error:', error);
    }
  }
}

async function generateUniqueInviteCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateInviteCode();
    const existing = await adminDb.collection('crewInviteCodes').doc(code).get();
    if (!existing.exists) {
      return code;
    }
  }
  throw new HttpsError('internal', 'INVITE_CODE_GENERATION_FAILED');
}

async function persistCrewInviteCode(
  crewRef: FirebaseFirestore.DocumentReference,
  inviteCode: string,
  expiresAt: string | null = null
) {
  const normalizedCode = inviteCode.toUpperCase();
  const now = new Date().toISOString();
  const previousSettingsSnap = await crewRef.collection('private').doc('settings').get();
  const previousInviteCode = String(previousSettingsSnap.data()?.inviteCode ?? '').trim().toUpperCase();
  const lookupWrites: Promise<unknown>[] = [
    adminDb.collection('crewInviteCodes').doc(normalizedCode).set(
      {
        code: normalizedCode,
        crewId: crewRef.id,
        expiresAt,
        updatedAt: now,
      },
      { merge: true }
    ),
  ];

  if (previousInviteCode && previousInviteCode !== normalizedCode) {
    lookupWrites.push(adminDb.collection('crewInviteCodes').doc(previousInviteCode).delete());
  }

  await Promise.all([
    crewRef.collection('private').doc('settings').set(
      {
        inviteCode: normalizedCode,
        expiresAt,
        updatedAt: now,
      },
      { merge: true }
    ),
    ...lookupWrites,
    crewRef.set(
      {
        inviteCode: FieldValue.delete(),
      },
      { merge: true }
    ),
  ]);
  return normalizedCode;
}

async function getOrCreateCrewInviteCode(
  crewRef: FirebaseFirestore.DocumentReference,
  crew?: CrewDoc
) {
  const privateSettingsSnap = await crewRef.collection('private').doc('settings').get();
  const privateInviteCode = String(privateSettingsSnap.data()?.inviteCode ?? '').trim().toUpperCase();
  if (privateInviteCode) {
    return {
      inviteCode: privateInviteCode,
      expiresAt: (privateSettingsSnap.data()?.expiresAt as string | null | undefined) ?? null,
    };
  }

  const crewData = crew ?? ((await crewRef.get()).data() as CrewDoc | undefined);
  const legacyInviteCode = String(crewData?.inviteCode ?? '').trim().toUpperCase();
  const inviteCode = legacyInviteCode || (await generateUniqueInviteCode());
  const persistedInviteCode = await persistCrewInviteCode(crewRef, inviteCode);
  return { inviteCode: persistedInviteCode, expiresAt: null };
}

function normalizeRequestedInviteCode(value: unknown) {
  const code = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (code.length < 4 || code.length > 16) {
    throw new HttpsError('invalid-argument', 'INVITE_CODE_LENGTH');
  }
  return code;
}

function normalizeInviteExpiration(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new HttpsError('invalid-argument', 'INVALID_INVITE_EXPIRATION');
  }
  if (date.getTime() <= Date.now()) {
    throw new HttpsError('invalid-argument', 'INVITE_EXPIRATION_IN_PAST');
  }
  return date.toISOString();
}

function isInviteExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const expiresAtMs = new Date(expiresAt).getTime();
  return Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now();
}

async function refreshCrewAggregates(crewId: string) {
  const crewRef = adminDb.collection('crews').doc(crewId);
  const [crewSnap, membersSnap, ridesSnap] = await Promise.all([
    crewRef.get(),
    crewRef.collection('members').get(),
    crewRef.collection('rides').get(),
  ]);

  if (!crewSnap.exists) return;

  const rides = ridesSnap.docs.map((docSnap) => docSnap.data() as Record<string, any>);
  const members = membersSnap.docs.map((docSnap) => docSnap.data() as CrewMemberDoc);

  const totalRides = rides.length;
  const totalMiles = rides.reduce((sum, ride) => sum + Number(ride.estimatedDistance ?? 0), 0);
  const totalPhotos = rides.reduce(
    (sum, ride) => sum + (Array.isArray(ride.photos) ? ride.photos.length : 0),
    0
  );
  const memberCount = members.filter((member) => !member.isDeveloperSupport).length;

  await crewRef.set(
    {
      memberCount,
      totalRides,
      totalMiles: Math.round(totalMiles * 10) / 10,
      totalPhotos,
    },
    { merge: true }
  );

  const completedRides = rides.filter((ride) => resolveRideStatus(ride) === 'completed');
  const now = new Date();
  const startOfDay = (date: Date) => {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  };
  const getWeekStart = (date: Date) => {
    const value = startOfDay(date);
    const diff = (value.getDay() + 6) % 7;
    value.setDate(value.getDate() - diff);
    return value;
  };
  const getWeekEnd = (date: Date) => {
    const value = getWeekStart(date);
    value.setDate(value.getDate() + 6);
    value.setHours(23, 59, 59, 999);
    return value;
  };
  const periods = [
    {
      period: 'week' as const,
      start: getWeekStart(now),
      end: getWeekEnd(now),
    },
    {
      period: 'month' as const,
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
    },
    {
      period: 'year' as const,
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
    },
  ];

  for (const period of periods) {
    const ridesInPeriod = completedRides.filter((ride) => {
      const rideDate = new Date(normalizeIso(ride.dateTime));
      return rideDate >= period.start && rideDate <= period.end;
    });
    const snapshotId = `${period.period}-${period.start.toISOString().slice(0, 10)}`;

    await crewRef.collection('statsHistory').doc(snapshotId).set(
      {
        id: snapshotId,
        crewId,
        period: period.period,
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
        totalRides: ridesInPeriod.length,
        totalMiles:
          Math.round(
            ridesInPeriod.reduce(
              (sum, ride) => sum + Number(ride.estimatedDistance ?? 0),
              0
            ) * 10
          ) / 10,
        totalPhotos: ridesInPeriod.reduce((sum, ride) => {
          const photos = Array.isArray(ride.photos) ? ride.photos : [];
          return sum + photos.length;
        }, 0),
        totalMembers: memberCount,
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }
}

async function getActingMemberContext(userId: string) {
  const userRef = adminDb.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'USER_NOT_FOUND');
  }

  const user = userSnap.data() as UserDoc;
  if (!user.crewId) {
    throw new HttpsError('failed-precondition', 'NO_CREW');
  }

  const crewRef = adminDb.collection('crews').doc(user.crewId);
  const memberRef = crewRef.collection('members').doc(userId);
  const [crewSnap, memberSnap] = await Promise.all([crewRef.get(), memberRef.get()]);

  if (!crewSnap.exists || !memberSnap.exists) {
    throw new HttpsError('failed-precondition', 'NO_CREW');
  }

  return {
    user,
    userRef,
    crewRef,
    crew: crewSnap.data() as CrewDoc,
    memberRef,
    member: memberSnap.data() as CrewMemberDoc,
  };
}

function requireActiveLeadership(member: CrewMemberDoc, crew: CrewDoc) {
  const role = member.role;
  if (role !== 'admin' && role !== 'officer') {
    throw new HttpsError('permission-denied', 'NOT_AUTHORIZED');
  }
  if (member.isDeveloperSupport) return;
  if (crew.ownerId !== member.id && !isActiveSubscription(crew.subscriptionStatus)) {
    throw new HttpsError('failed-precondition', 'SUBSCRIPTION_INACTIVE');
  }
}

function requireAdmin(member: CrewMemberDoc, crew: CrewDoc) {
  if (member.role !== 'admin') {
    throw new HttpsError('permission-denied', 'NOT_AUTHORIZED');
  }
  if (member.isDeveloperSupport) return;
  if (crew.ownerId !== member.id && !isActiveSubscription(crew.subscriptionStatus)) {
    throw new HttpsError('failed-precondition', 'SUBSCRIPTION_INACTIVE');
  }
}

async function exitCrew(userId: string, deleteAccount: boolean): Promise<ExitCrewResult> {
  const result = await adminDb.runTransaction(async (transaction) => {
    const userRef = adminDb.collection('users').doc(userId);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) {
      return {
        crewId: null,
        crewName: null,
        ownershipTransferred: false,
        crewArchived: false,
        leftAsOwner: false,
        shouldManageSubscription: false,
        nextOwnerId: null,
        nextOwnerName: null,
      } satisfies ExitCrewResult;
    }

    const user = userSnap.data() as UserDoc;
    if (!user.crewId) {
      transaction.set(userRef, { crewId: null, role: 'member' }, { merge: true });

      return {
        crewId: null,
        crewName: null,
        ownershipTransferred: false,
        crewArchived: false,
        leftAsOwner: false,
        shouldManageSubscription: false,
        nextOwnerId: null,
        nextOwnerName: null,
      } satisfies ExitCrewResult;
    }

    const crewRef = adminDb.collection('crews').doc(user.crewId);
    const memberRef = crewRef.collection('members').doc(userId);
    const membersQuery = crewRef.collection('members');

    const [crewSnap, membersSnap] = await Promise.all([
      transaction.get(crewRef),
      transaction.get(membersQuery),
    ]);

    if (!crewSnap.exists) {
      transaction.set(userRef, { crewId: null, role: 'member' }, { merge: true });
      return {
        crewId: user.crewId,
        crewName: null,
        ownershipTransferred: false,
        crewArchived: false,
        leftAsOwner: false,
        shouldManageSubscription: false,
        nextOwnerId: null,
        nextOwnerName: null,
      } satisfies ExitCrewResult;
    }

    const crew = crewSnap.data() as CrewDoc;
    const members = membersSnap.docs.map((docSnap) => docSnap.data() as CrewMemberDoc);
    const isOwner = crew.ownerId === userId;
    const remainingMembers = members.filter(
      (member) => member.id !== userId && !member.isDeveloperSupport
    );
    const nextOwner =
      isOwner && remainingMembers.length > 0
        ? pickNextOwner(members, userId) ?? remainingMembers[0]
        : null;
    const now = new Date();
    const archiveFields = buildArchiveFields(now);

    if (remainingMembers.length === 0) {
      transaction.set(
        crewRef,
        {
          ownerId: null,
          subscriptionOwnerId: null,
          subscriptionStatus: 'inactive',
          status: 'archived',
          archivedAt: archiveFields.archivedAt,
          purgeAt: archiveFields.purgeAt,
          memberCount: 0,
        },
        { merge: true }
      );
    } else if (isOwner && nextOwner) {
      transaction.set(
        crewRef,
        {
          ownerId: nextOwner.id,
          subscriptionOwnerId: null,
          subscriptionStatus: 'inactive',
          status: 'active',
          archivedAt: null,
          purgeAt: null,
          memberCount: remainingMembers.length,
        },
        { merge: true }
      );
      transaction.set(
        crewRef.collection('members').doc(nextOwner.id),
        { role: 'admin' },
        { merge: true }
      );
      transaction.set(
        adminDb.collection('users').doc(nextOwner.id),
        { role: 'admin' },
        { merge: true }
      );
    } else {
      transaction.set(
        crewRef,
        {
          memberCount: remainingMembers.length,
        },
        { merge: true }
      );
    }

    transaction.delete(memberRef);
    transaction.set(userRef, { crewId: null, role: 'member' }, { merge: true });

    return {
      crewId: crewRef.id,
      crewName: crew.name ?? null,
      ownershipTransferred: Boolean(isOwner && nextOwner),
      crewArchived: remainingMembers.length === 0,
      leftAsOwner: isOwner,
      shouldManageSubscription:
        Boolean(isOwner) || Boolean(crew.subscriptionOwnerId && crew.subscriptionOwnerId === userId),
      nextOwnerId: nextOwner?.id ?? null,
      nextOwnerName: nextOwner?.name ?? null,
    } satisfies ExitCrewResult;
  });

  return result;
}

function normalizeAnalyticsEvent(input: AnalyticsEventInput, fallbackUserId: string | null) {
  const eventName = String(input.eventName ?? '').trim();
  if (!eventName) {
    throw new HttpsError('invalid-argument', 'EVENT_NAME_REQUIRED');
  }

  return {
    id: String(input.id ?? `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`),
    eventName,
    actorUserId: input.actorUserId ?? fallbackUserId ?? null,
    crewId: input.crewId ?? null,
    route: input.route ?? null,
    sessionId: String(input.sessionId ?? ''),
    installationId: String(input.installationId ?? ''),
    appVersion: input.appVersion ?? null,
    buildNumber: input.buildNumber ?? null,
    platform: String(input.platform ?? 'unknown'),
    clientTimestamp: input.clientTimestamp ?? new Date().toISOString(),
    properties: input.properties ?? {},
  };
}

export const recordAnalyticsEvents = onCall(async (request) => {
  const rawEvents = Array.isArray(request.data?.events)
    ? request.data.events
    : request.data?.event
      ? [request.data.event]
      : [];

  if (rawEvents.length === 0) {
    throw new HttpsError('invalid-argument', 'EVENTS_REQUIRED');
  }

  const events = rawEvents.slice(0, 25).map((event: AnalyticsEventInput) =>
    normalizeAnalyticsEvent(event, request.auth?.uid ?? null)
  );

  const batch = adminDb.batch();
  const dailyCounts = new Map<
    string,
    { totalEvents: number; eventCounts: Record<string, number>; appVersion: string | null }
  >();

  for (const event of events) {
    const eventRef = adminDb.collection('analyticsEvents').doc(event.id);
    batch.set(eventRef, {
      ...event,
      createdAt: FieldValue.serverTimestamp(),
    });

    const dayKey = event.clientTimestamp.slice(0, 10) || new Date().toISOString().slice(0, 10);
    const current =
      dailyCounts.get(dayKey) ?? {
      totalEvents: 0,
      eventCounts: {} as Record<string, number>,
      appVersion: event.appVersion ?? null,
    };
    current.totalEvents += 1;
    current.eventCounts[event.eventName] = (current.eventCounts[event.eventName] ?? 0) + 1;
    if (!current.appVersion && event.appVersion) {
      current.appVersion = event.appVersion;
    }
    dailyCounts.set(dayKey, current);
  }

  for (const [dayKey, summary] of dailyCounts.entries()) {
    batch.set(
      adminDb.collection('analyticsDaily').doc(dayKey),
      {
        id: dayKey,
        date: dayKey,
        totalEvents: FieldValue.increment(summary.totalEvents),
        appVersion: summary.appVersion,
        eventCounts: Object.entries(summary.eventCounts).reduce<Record<string, unknown>>(
          (acc, [eventName, count]) => {
            acc[eventName] = FieldValue.increment(count);
            return acc;
          },
          {}
        ),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  await batch.commit();
  return { recorded: events.length };
});

export const joinCrewByInvite = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  }

  const inviteCode = String(request.data?.inviteCode ?? '')
    .trim()
    .toUpperCase();
  if (!inviteCode) {
    throw new HttpsError('invalid-argument', 'INVALID_INVITE_CODE');
  }

  const userRef = adminDb.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError('not-found', 'USER_NOT_FOUND');
  }

  const user = userSnap.data() as UserDoc;
  const inviteLookupSnap = await adminDb.collection('crewInviteCodes').doc(inviteCode).get();

  let crewDoc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null = null;
  if (inviteLookupSnap.exists) {
    const lookupData = inviteLookupSnap.data() as { crewId?: string; expiresAt?: string | null };
    if (isInviteExpired(lookupData.expiresAt)) {
      throw new HttpsError('failed-precondition', 'INVITE_CODE_EXPIRED');
    }
    if (lookupData.crewId) {
      const candidate = await adminDb.collection('crews').doc(lookupData.crewId).get();
      if (candidate.exists) {
        crewDoc = candidate;
      }
    }
  }

  if (!crewDoc) {
    const legacyCrewSnap = await adminDb
      .collection('crews')
      .where('inviteCode', '==', inviteCode)
      .limit(1)
      .get();

    if (legacyCrewSnap.empty) {
      throw new HttpsError('not-found', 'INVALID_INVITE_CODE');
    }

    crewDoc = legacyCrewSnap.docs[0];
    await persistCrewInviteCode(crewDoc.ref, inviteCode);
  }

  const crew = crewDoc.data() as CrewDoc;
  const settingsSnap = await crewDoc.ref.collection('private').doc('settings').get();
  const settingsData = settingsSnap.data() as { inviteCode?: string; expiresAt?: string | null } | undefined;
  if (
    String(settingsData?.inviteCode ?? '').trim().toUpperCase() === inviteCode &&
    isInviteExpired(settingsData?.expiresAt)
  ) {
    throw new HttpsError('failed-precondition', 'INVITE_CODE_EXPIRED');
  }

  if (crew.status === 'archived') {
    throw new HttpsError('failed-precondition', 'CREW_ARCHIVED');
  }
  if (user.crewId && user.crewId !== crewDoc.id) {
    throw new HttpsError('failed-precondition', 'ALREADY_IN_CREW');
  }

  const memberRef = crewDoc.ref.collection('members').doc(userId);
  const joinRequestRef = crewDoc.ref.collection('joinRequests').doc(userId);
  const memberSnap = await memberRef.get();

  if (!memberSnap.exists) {
    await adminDb.runTransaction(async (transaction) => {
      const [freshUserSnap, freshCrewSnap, freshMemberSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(crewDoc.ref),
        transaction.get(memberRef),
      ]);

      if (!freshUserSnap.exists || !freshCrewSnap.exists) {
        throw new HttpsError('not-found', 'JOIN_TARGET_NOT_FOUND');
      }

      const freshUser = freshUserSnap.data() as UserDoc;
      if (freshUser.crewId && freshUser.crewId !== crewDoc.id) {
        throw new HttpsError('failed-precondition', 'ALREADY_IN_CREW');
      }

      if (!freshMemberSnap.exists) {
        transaction.set(
          memberRef,
          {
            id: userId,
            email: freshUser.email ?? '',
            name: freshUser.name ?? 'Member',
            avatar: freshUser.avatar ?? '',
            bike: freshUser.bike ?? '',
            role: 'member',
            joinedCrewAt: new Date().toISOString(),
            ridesAttended: 0,
            milesTraveled: 0,
          },
          { merge: true }
        );
        transaction.set(
          crewDoc.ref,
          {
            memberCount: FieldValue.increment(1),
            status: 'active',
            archivedAt: null,
            purgeAt: null,
          },
          { merge: true }
        );
      }

      transaction.set(userRef, { crewId: crewDoc.id, role: 'member' }, { merge: true });
      transaction.set(
        joinRequestRef,
        {
          status: 'approved',
          decidedAt: new Date().toISOString(),
          decidedBy: SYSTEM_ACTOR,
        },
        { merge: true }
      );
    });
  }

  return {
    crewId: crewDoc.id,
    crewName: crew.name ?? null,
  };
});

export const getCrewInviteCode = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  }

  const context = await getActingMemberContext(userId);
  requireAdmin(context.member, context.crew);
  return getOrCreateCrewInviteCode(context.crewRef, context.crew);
});

export const setCrewInviteCode = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  }

  const context = await getActingMemberContext(userId);
  requireAdmin(context.member, context.crew);

  const requestedCode = request.data?.inviteCode;
  const inviteCode = requestedCode
    ? normalizeRequestedInviteCode(requestedCode)
    : await generateUniqueInviteCode();
  const expiresAt = normalizeInviteExpiration(request.data?.expiresAt);

  const existingSnap = await adminDb.collection('crewInviteCodes').doc(inviteCode).get();
  if (existingSnap.exists) {
    const existing = existingSnap.data() as { crewId?: string };
    if (existing.crewId && existing.crewId !== context.crewRef.id) {
      throw new HttpsError('already-exists', 'INVITE_CODE_TAKEN');
    }
  }

  const persistedInviteCode = await persistCrewInviteCode(context.crewRef, inviteCode, expiresAt);
  return { inviteCode: persistedInviteCode, expiresAt };
});

export const leaveCrew = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  }

  const result = await exitCrew(userId, false);
  return result;
});

export const deleteAccountAndCleanup = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  }

  const result = await exitCrew(userId, true);
  const userRef = adminDb.collection('users').doc(userId);

  await Promise.all([
    anonymizeUserGeneratedContent(userId),
    deleteUserPushTokens(userId),
    deleteUserStorage(userId),
  ]);

  try {
    await adminAuth.deleteUser(userId);
  } catch (error: any) {
    const code = String(error?.code ?? '');
    if (code !== 'auth/user-not-found') {
      console.log('[Functions] deleteUser error:', error);
      throw new HttpsError('internal', 'ACCOUNT_DELETE_FAILED');
    }
  }

  await userRef.delete().catch((error) => {
    console.log('[Functions] delete user profile error:', error);
    throw new HttpsError('internal', 'ACCOUNT_PROFILE_DELETE_FAILED');
  });

  return result;
});

export const approveJoinRequest = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  }

  const requestId = String(request.data?.requestId ?? '').trim();
  if (!requestId) {
    throw new HttpsError('invalid-argument', 'REQUEST_ID_REQUIRED');
  }

  const context = await getActingMemberContext(userId);
  requireActiveLeadership(context.member, context.crew);

  const joinRequestRef = context.crewRef.collection('joinRequests').doc(requestId);
  const joinRequestSnap = await joinRequestRef.get();
  if (!joinRequestSnap.exists) {
    throw new HttpsError('not-found', 'JOIN_REQUEST_NOT_FOUND');
  }

  const joinRequest = joinRequestSnap.data() as JoinRequestDoc;
  const targetUserRef = adminDb.collection('users').doc(joinRequest.userId);
  const targetMemberRef = context.crewRef.collection('members').doc(joinRequest.userId);

  await adminDb.runTransaction(async (transaction) => {
    const [targetUserSnap, targetMemberSnap, freshRequestSnap] = await Promise.all([
      transaction.get(targetUserRef),
      transaction.get(targetMemberRef),
      transaction.get(joinRequestRef),
    ]);

    if (!freshRequestSnap.exists) {
      throw new HttpsError('not-found', 'JOIN_REQUEST_NOT_FOUND');
    }

    const freshRequest = freshRequestSnap.data() as JoinRequestDoc;
    if (freshRequest.status === 'approved') return;
    if (!targetUserSnap.exists) {
      throw new HttpsError('not-found', 'USER_NOT_FOUND');
    }

    const targetUser = targetUserSnap.data() as UserDoc;
    if (targetUser.crewId && targetUser.crewId !== context.crewRef.id) {
      throw new HttpsError('failed-precondition', 'USER_ALREADY_IN_CREW');
    }

    if (!targetMemberSnap.exists) {
      transaction.set(
        targetMemberRef,
        {
          id: joinRequest.userId,
          email: targetUser.email ?? joinRequest.userEmail ?? '',
          name: targetUser.name ?? joinRequest.userName ?? 'Member',
          avatar: targetUser.avatar ?? joinRequest.userAvatar ?? '',
          bike: targetUser.bike ?? '',
          role: 'member',
          joinedCrewAt: new Date().toISOString(),
          ridesAttended: 0,
          milesTraveled: 0,
        },
        { merge: true }
      );
      transaction.set(
        context.crewRef,
        { memberCount: FieldValue.increment(1) },
        { merge: true }
      );
    }

    transaction.set(targetUserRef, { crewId: context.crewRef.id, role: 'member' }, { merge: true });
    transaction.set(
      joinRequestRef,
      {
        status: 'approved',
        decidedAt: new Date().toISOString(),
        decidedBy: userId,
      },
      { merge: true }
    );
  });

  return { ok: true };
});

export const denyJoinRequest = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  }

  const requestId = String(request.data?.requestId ?? '').trim();
  if (!requestId) {
    throw new HttpsError('invalid-argument', 'REQUEST_ID_REQUIRED');
  }

  const context = await getActingMemberContext(userId);
  requireActiveLeadership(context.member, context.crew);

  await context.crewRef.collection('joinRequests').doc(requestId).set(
    {
      status: 'denied',
      decidedAt: new Date().toISOString(),
      decidedBy: userId,
    },
    { merge: true }
  );

  return { ok: true };
});

export const removeCrewMember = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  }

  const memberId = String(request.data?.memberId ?? '').trim();
  if (!memberId) {
    throw new HttpsError('invalid-argument', 'MEMBER_ID_REQUIRED');
  }

  const context = await getActingMemberContext(userId);
  requireAdmin(context.member, context.crew);

  if (context.crew.ownerId === memberId) {
    throw new HttpsError('failed-precondition', 'OWNER_REMOVE_NOT_ALLOWED');
  }

  const targetMemberRef = context.crewRef.collection('members').doc(memberId);
  const targetUserRef = adminDb.collection('users').doc(memberId);
  const targetMemberSnap = await targetMemberRef.get();
  if (!targetMemberSnap.exists) {
    throw new HttpsError('not-found', 'MEMBER_NOT_FOUND');
  }

  await adminDb.runTransaction(async (transaction) => {
    const [freshTargetMemberSnap, targetUserSnap] = await Promise.all([
      transaction.get(targetMemberRef),
      transaction.get(targetUserRef),
    ]);

    if (!freshTargetMemberSnap.exists) {
      return;
    }

    transaction.delete(targetMemberRef);
    transaction.set(
      context.crewRef,
      { memberCount: FieldValue.increment(-1) },
      { merge: true }
    );
    if (targetUserSnap.exists) {
      transaction.set(targetUserRef, { crewId: null, role: 'member' }, { merge: true });
    }
  });

  return { ok: true };
});

export const setCrewMemberRole = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  }

  const memberId = String(request.data?.memberId ?? '').trim();
  const role = String(request.data?.role ?? '').trim() as UserRole;
  if (!memberId || !['admin', 'officer', 'member'].includes(role)) {
    throw new HttpsError('invalid-argument', 'INVALID_MEMBER_ROLE');
  }

  const context = await getActingMemberContext(userId);
  requireAdmin(context.member, context.crew);

  if (context.crew.ownerId === memberId && role !== 'admin') {
    throw new HttpsError('failed-precondition', 'OWNER_ROLE_LOCKED');
  }

  const targetMemberRef = context.crewRef.collection('members').doc(memberId);
  const targetUserRef = adminDb.collection('users').doc(memberId);
  const targetMemberSnap = await targetMemberRef.get();
  if (!targetMemberSnap.exists) {
    throw new HttpsError('not-found', 'MEMBER_NOT_FOUND');
  }

  await Promise.all([
    targetMemberRef.set({ role }, { merge: true }),
    targetUserRef.set({ role }, { merge: true }),
  ]);

  return { ok: true };
});

export const setCrewMemberLeadership = onCall(async (request) => {
  const userId = request.auth?.uid;
  if (!userId) {
    throw new HttpsError('unauthenticated', 'AUTH_REQUIRED');
  }

  const memberId = String(request.data?.memberId ?? '').trim();
  const nextRole = request.data?.role == null ? undefined : String(request.data.role).trim() as UserRole;
  const leadershipTitle = String(request.data?.leadershipTitle ?? '').trim().slice(0, 48);

  if (!memberId) {
    throw new HttpsError('invalid-argument', 'MEMBER_ID_REQUIRED');
  }
  if (nextRole && !['admin', 'officer', 'member'].includes(nextRole)) {
    throw new HttpsError('invalid-argument', 'INVALID_MEMBER_ROLE');
  }

  const context = await getActingMemberContext(userId);
  requireAdmin(context.member, context.crew);

  if (context.crew.ownerId === memberId && nextRole && nextRole !== 'admin') {
    throw new HttpsError('failed-precondition', 'OWNER_ROLE_LOCKED');
  }

  const targetMemberRef = context.crewRef.collection('members').doc(memberId);
  const targetUserRef = adminDb.collection('users').doc(memberId);
  const targetMemberSnap = await targetMemberRef.get();
  if (!targetMemberSnap.exists) {
    throw new HttpsError('not-found', 'MEMBER_NOT_FOUND');
  }

  const memberUpdates: Record<string, unknown> = {
    leadershipTitle: leadershipTitle || FieldValue.delete(),
  };
  const userUpdates: Record<string, unknown> = {
    leadershipTitle: leadershipTitle || FieldValue.delete(),
  };

  if (nextRole) {
    memberUpdates.role = nextRole;
    userUpdates.role = nextRole;
  }

  await Promise.all([
    targetMemberRef.set(memberUpdates, { merge: true }),
    targetUserRef.set(userUpdates, { merge: true }),
  ]);

  return { ok: true };
});

export const revenueCatWebhook = onRequest(
  async (request, response) => {
    const expectedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (!expectedSecret) {
      response.status(503).json({ error: 'RevenueCat webhook is not configured.' });
      return;
    }

    const authHeader = String(request.headers.authorization ?? '');
    const signatureHeader = String(request.headers['x-revenuecat-signature'] ?? '');

    const authorized =
      authHeader === `Bearer ${expectedSecret}` ||
      authHeader === expectedSecret ||
      signatureHeader === expectedSecret;

    if (!authorized) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const payload =
      typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body ?? {};
    const parsed = parseRevenueCatPayload(payload);
    if (!parsed.appUserId) {
      response.status(400).json({ error: 'Missing app user id' });
      return;
    }

    const userSnap = await adminDb.collection('users').doc(parsed.appUserId).get();
    const currentCrewId = userSnap.exists ? ((userSnap.data() as UserDoc).crewId ?? null) : null;
    let crewRef = currentCrewId ? adminDb.collection('crews').doc(currentCrewId) : null;

    if (!crewRef) {
      const crewSnap = await adminDb
        .collection('crews')
        .where('subscriptionOwnerId', '==', parsed.appUserId)
        .limit(1)
        .get();
      if (!crewSnap.empty) {
        crewRef = crewSnap.docs[0].ref;
      }
    }

    if (!crewRef) {
      response.status(200).json({ ok: true, ignored: true });
      return;
    }

    await crewRef.set(
      {
        subscriptionStatus: parsed.status,
        subscriptionOwnerId:
          parsed.status === 'inactive' ? null : parsed.appUserId,
      },
      { merge: true }
    );

    response.status(200).json({ ok: true });
  }
);

export const purgeArchivedCrews = onSchedule('every day 03:00', async () => {
  const archivedCrewsSnap = await adminDb
    .collection('crews')
    .where('status', '==', 'archived')
    .get();

  const now = Date.now();
  for (const crewDoc of archivedCrewsSnap.docs) {
    const crew = crewDoc.data() as CrewDoc;
    const purgeAt = crew.purgeAt ? new Date(crew.purgeAt).getTime() : Number.POSITIVE_INFINITY;
    if (purgeAt > now) continue;

    const inviteMappings = await adminDb
      .collection('crewInviteCodes')
      .where('crewId', '==', crewDoc.id)
      .get();
    if (!inviteMappings.empty) {
      let batch = adminDb.batch();
      let operations = 0;
      for (const inviteDoc of inviteMappings.docs) {
        batch.delete(inviteDoc.ref);
        operations += 1;
        if (operations === 400) {
          await batch.commit();
          batch = adminDb.batch();
          operations = 0;
        }
      }
      await flushBatch(batch, operations);
    }

    try {
      await storage.bucket().deleteFiles({ prefix: `crews/${crewDoc.id}/` });
    } catch (error: any) {
      const message = String(error?.message ?? '');
      if (!message.includes('No such object') && !message.includes('Not Found')) {
        console.log('[Functions] Crew storage cleanup error:', error);
      }
    }

    await adminDb.recursiveDelete(crewDoc.ref);
  }
});

export const onCrewRideWritten = onDocumentWritten(
  { database: 'default', document: 'crews/{crewId}/rides/{rideId}' },
  async (event) => {
    const crewId = event.params.crewId as string;
    const rideId = event.params.rideId as string;
    await refreshCrewAggregates(crewId);

    const beforeExists = event.data?.before.exists ?? false;
    const afterExists = event.data?.after.exists ?? false;
    const before = event.data?.before.data() as RideDoc | undefined;
    const after = event.data?.after.data() as RideDoc | undefined;
    if (!afterExists || !after) return;

    const rideTitle = after.title || 'New ride';

    if (!beforeExists) {
      await notifyCrewMembers({
        crewId,
        notificationType: 'rides',
        excludeUserIds: [after.createdBy || ''],
        title: 'New Ride Posted',
        body: `${rideTitle} is on the calendar.`,
        data: { crewId, rideId, type: 'ride_created' },
      });
      return;
    }

    if (!before) return;

    const beforeAttendees = new Set(before.attendees || []);
    const afterAttendees = new Set(after.attendees || []);
    const joined = [...afterAttendees].filter((userId) => !beforeAttendees.has(userId));
    const left = [...beforeAttendees].filter((userId) => !afterAttendees.has(userId));

    for (const userId of joined) {
      const memberName = await getMemberName(crewId, userId);
      await notifyCrewLeaders({
        crewId,
        notificationType: 'rides',
        excludeUserIds: [userId],
        title: 'Ride RSVP',
        body: `${memberName} joined ${rideTitle}.`,
        data: { crewId, rideId, userId, type: 'ride_joined' },
      });
    }

    for (const userId of left) {
      const memberName = await getMemberName(crewId, userId);
      await notifyCrewLeaders({
        crewId,
        notificationType: 'rides',
        excludeUserIds: [userId],
        title: 'Ride RSVP',
        body: `${memberName} left ${rideTitle}.`,
        data: { crewId, rideId, userId, type: 'ride_left' },
      });
    }

    const beforePhotos = before.photos || [];
    const afterPhotos = after.photos || [];
    if (afterPhotos.length > beforePhotos.length) {
      const addedPhotos = afterPhotos.slice(beforePhotos.length);
      const uploaderIds = [...new Set(addedPhotos.map((photo) => photo.uploadedBy).filter(Boolean) as string[])];
      const firstPhoto = addedPhotos[0];
      const uploaderName = firstPhoto?.uploadedByName || 'A member';
      await notifyCrewMembers({
        crewId,
        notificationType: 'rides',
        excludeUserIds: uploaderIds,
        title: beforePhotos.length === 0 ? 'Ride Album Started' : 'New Ride Photos',
        body:
          beforePhotos.length === 0
            ? `${uploaderName} started the album for ${rideTitle}.`
            : `${uploaderName} added photos to ${rideTitle}.`,
        data: { crewId, rideId, type: 'ride_photos_added' },
      });
    }
  }
);

export const onCrewMemberWritten = onDocumentWritten(
  { database: 'default', document: 'crews/{crewId}/members/{memberId}' },
  async (event) => {
    const crewId = event.params.crewId as string;
    const memberId = event.params.memberId as string;
    await refreshCrewAggregates(crewId);

    const beforeExists = event.data?.before.exists ?? false;
    const afterExists = event.data?.after.exists ?? false;
    const before = event.data?.before.data() as CrewMemberDoc | undefined;
    const after = event.data?.after.data() as CrewMemberDoc | undefined;
    const crewName = await getCrewName(crewId);

    if (!beforeExists && afterExists && after && !after.isDeveloperSupport) {
      await notifyCrewLeaders({
        crewId,
        excludeUserIds: [memberId],
        title: 'New Member Joined',
        body: `${after.name || 'A member'} joined ${crewName}.`,
        data: { crewId, memberId, type: 'member_joined' },
      });
    }

    if (beforeExists && !afterExists && before && !before.isDeveloperSupport) {
      await notifyCrewLeaders({
        crewId,
        excludeUserIds: [memberId],
        title: 'Member Left',
        body: `${before.name || 'A member'} left ${crewName}.`,
        data: { crewId, memberId, type: 'member_left' },
      });
    }
  }
);

export const onAnnouncementCreated = onDocumentCreated(
  { database: 'default', document: 'crews/{crewId}/announcements/{announcementId}' },
  async (event) => {
    const crewId = event.params.crewId as string;
    const announcementId = event.params.announcementId as string;
    const data = event.data?.data() as AnnouncementDoc | undefined;
    if (!data) return;

    await notifyCrewMembers({
      crewId,
      notificationType: 'announcements',
      excludeUserIds: [data.authorId || ''],
      title: data.title || 'New Announcement',
      body: data.content ? data.content.slice(0, 120) : `${data.authorName || 'An admin'} posted an announcement.`,
      data: { crewId, announcementId, type: 'announcement_created' },
    });
  }
);

export const onJoinRequestCreated = onDocumentCreated(
  { database: 'default', document: 'crews/{crewId}/joinRequests/{requestId}' },
  async (event) => {
    const crewId = event.params.crewId as string;
    const data = event.data?.data() as JoinRequestDoc | undefined;
    if (!data) return;

    const crewSnap = await adminDb.collection('crews').doc(crewId).get();
    const crewName = crewSnap.exists ? ((crewSnap.data() as CrewDoc).name ?? 'your crew') : 'your crew';

    const membersSnap = await adminDb
      .collection('crews')
      .doc(crewId)
      .collection('members')
      .where('role', 'in', ['admin', 'officer'])
      .get();

    const messages: ExpoPushMessage[] = [];

    for (const memberDoc of membersSnap.docs) {
      const memberId = memberDoc.id;
      const prefs = await getUserPreferences(memberId);
      if (prefs.pushEnabled === false || prefs.joinRequests === false) continue;
      const tokens = await getUserPushTokens(memberId);
      tokens.forEach((token) => {
        messages.push({
          to: token,
          title: 'New Join Request',
          body: `${data.userName || 'Someone'} requested to join ${crewName}.`,
          data: { crewId, requestId: data.id || event.params.requestId },
        });
      });
    }

    await sendExpoPush(messages);
  }
);

export const onJoinRequestUpdated = onDocumentUpdated(
  { database: 'default', document: 'crews/{crewId}/joinRequests/{requestId}' },
  async (event) => {
    const before = event.data?.before.data() as JoinRequestDoc | undefined;
    const after = event.data?.after.data() as JoinRequestDoc | undefined;
    if (!before || !after) return;
    if (before.status === after.status) return;
    if (!['approved', 'denied'].includes(after.status ?? '')) return;

    const crewId = event.params.crewId as string;
    const crewSnap = await adminDb.collection('crews').doc(crewId).get();
    const crewName = crewSnap.exists ? ((crewSnap.data() as CrewDoc).name ?? 'your crew') : 'your crew';

    const prefs = await getUserPreferences(after.userId);
    if (prefs.pushEnabled === false || prefs.joinRequests === false) return;

    const tokens = await getUserPushTokens(after.userId);
    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      title: 'Join Request Update',
      body:
        after.status === 'approved'
          ? `You were approved to join ${crewName}.`
          : `Your request to join ${crewName} was denied.`,
      data: { crewId, requestId: event.params.requestId },
    }));

    await sendExpoPush(messages);
  }
);
