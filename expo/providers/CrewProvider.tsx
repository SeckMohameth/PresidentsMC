import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useMemo, useCallback, useState } from 'react';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteObject, ref } from 'firebase/storage';
import { db, functions, storage } from '@/utils/firebase';
import { trackAnalyticsEvent } from '@/utils/analytics';
import { useAuth } from '@/providers/AuthProvider';
import {
  CrewMember,
  Crew,
  Announcement,
  Ride,
  CrewStats,
  MemberStats,
  RidePhoto,
  CrewStatsSnapshot,
  JoinRequest,
  CrewAlbum,
} from '@/types';
import { calculateDistanceMiles } from '@/utils/helpers';
import { getDefaultRideCoverUri } from '@/constants/coverImages';
import { isRemoteImageUri, uploadImageUri } from '@/utils/storageUpload';

export type InviteCodeSettings = {
  inviteCode: string;
  expiresAt: string | null;
};

function normalizeDate(value: any) {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  return new Date().toISOString();
}

function stripUndefined(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

function generateInviteCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function uploadImageIfNeeded(uri: string, path: string) {
  if (!uri) return uri;
  if (isRemoteImageUri(uri)) return uri;
  return uploadImageUri(uri, path);
}

async function deleteStoragePath(path: string) {
  try {
    await deleteObject(ref(storage, path));
  } catch (error: any) {
    const code = String(error?.code ?? '');
    if (code !== 'storage/object-not-found') {
      console.log('[CrewProvider] Storage cleanup skipped:', path, error);
    }
  }
}

function resolveRideStatus(ride: Pick<Ride, 'status' | 'dateTime'>): Ride['status'] {
  if (ride.status !== 'upcoming') return ride.status;
  const rideTime = new Date(ride.dateTime).getTime();
  if (Number.isNaN(rideTime)) return ride.status;
  return rideTime < Date.now() ? 'completed' : ride.status;
}

export const [CrewProvider, useCrew] = createContextHook(() => {
  const { user } = useAuth();
  const crewId = user?.crewId || null;

  const [currentUser, setCurrentUser] = useState<CrewMember | null>(null);
  const [crew, setCrew] = useState<Crew | null>(null);
  const [members, setMembers] = useState<CrewMember[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [albums, setAlbums] = useState<CrewAlbum[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingRide, setIsCreatingRide] = useState(false);
  const [statsHistory, setStatsHistory] = useState<CrewStatsSnapshot[]>([]);

  const isAdmin = currentUser?.role === 'admin';
  const isOfficer = currentUser?.role === 'officer';
  const isDeveloperSupport = !!currentUser?.isDeveloperSupport;
  const isOwner = !!currentUser?.id && crew?.ownerId === currentUser.id;
  const permissions = currentUser?.permissions || {};
  const isSubscriptionActive =
    crew?.subscriptionStatus === 'active' || crew?.subscriptionStatus === 'trialing';
  const isBillingRequired = crew?.billingRequired === true;
  const canUseAdminTools = isAdmin || isOfficer || isDeveloperSupport;
  const hasPaidFeatureAccess = !isBillingRequired || isSubscriptionActive;
  const canManageRides =
    isDeveloperSupport || ((isAdmin || isOfficer || permissions.manageRides === true) && hasPaidFeatureAccess);
  const canManageAnnouncements =
    isDeveloperSupport || isAdmin || isOfficer || permissions.manageAnnouncements === true;
  const canManageAlbums =
    isDeveloperSupport || ((isAdmin || isOfficer || permissions.manageAlbums === true) && hasPaidFeatureAccess);
  const canManageJoinRequests =
    isDeveloperSupport || isAdmin || isOfficer || permissions.manageJoinRequests === true;
  const canPost = canManageRides || canManageAnnouncements;

  const assertAdminActive = useCallback(() => {
    if (isDeveloperSupport) return;
    if (isOwner) return;
    if (isBillingRequired && !isSubscriptionActive) {
      throw new Error('SUBSCRIPTION_INACTIVE');
    }
  }, [isBillingRequired, isDeveloperSupport, isOwner, isSubscriptionActive]);

  const assertAdminOrOfficer = useCallback(() => {
    if (!isAdmin && !isOfficer) {
      throw new Error('NOT_AUTHORIZED');
    }
  }, [isAdmin, isOfficer]);

  const assertCanManageRides = useCallback(() => {
    if (!canManageRides) throw new Error('NOT_AUTHORIZED');
  }, [canManageRides]);

  const assertCanManageAnnouncements = useCallback(() => {
    if (!canManageAnnouncements) throw new Error('NOT_AUTHORIZED');
  }, [canManageAnnouncements]);

  const assertCanManageJoinRequests = useCallback(() => {
    if (!canManageJoinRequests) throw new Error('NOT_AUTHORIZED');
  }, [canManageJoinRequests]);

  const assertAdmin = useCallback(() => {
    if (!isAdmin) {
      throw new Error('NOT_AUTHORIZED');
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!crewId) {
      setCrew(null);
      setMembers([]);
      setAnnouncements([]);
      setRides([]);
      setAlbums([]);
      setJoinRequests([]);
      setCurrentUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const crewRef = doc(db, 'crews', crewId);
    const membersRef = collection(db, 'crews', crewId, 'members');
    const announcementsRef = collection(db, 'crews', crewId, 'announcements');
    const ridesRef = collection(db, 'crews', crewId, 'rides');
    const albumsRef = collection(db, 'crews', crewId, 'albums');
    const joinRequestsRef = collection(db, 'crews', crewId, 'joinRequests');

    const unsubCrew = onSnapshot(crewRef, (snap) => {
      const data = snap.data() as Crew | undefined;
      if (!data) {
        setCrew(null);
        return;
      }
      setCrew({
        ...data,
        createdAt: normalizeDate(data.createdAt),
      });
    });

    const unsubMembers = onSnapshot(membersRef, (snap) => {
      const list = snap.docs.map((docSnap) => {
        const data = docSnap.data() as CrewMember;
        return {
          ...data,
          joinedCrewAt: normalizeDate(data.joinedCrewAt),
          joinedAt: normalizeDate(data.joinedAt),
        };
      });
      setMembers(list.filter((member) => !member.isDeveloperSupport));
      const self = list.find((member) => member.id === user?.id) || null;
      setCurrentUser(self);
    });

    const announcementsQuery = query(announcementsRef, orderBy('createdAt', 'desc'));
    const unsubAnnouncements = onSnapshot(announcementsQuery, (snap) => {
      const list = snap.docs.map((docSnap) => {
        const data = docSnap.data() as Announcement;
        return {
          ...data,
          id: docSnap.id,
          createdAt: normalizeDate(data.createdAt),
        };
      });
      list.sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
      setAnnouncements(list);
    });

    const ridesQuery = query(ridesRef, orderBy('dateTime', 'asc'));
    const unsubRides = onSnapshot(ridesQuery, (snap) => {
      const list = snap.docs.map((docSnap) => {
        const data = docSnap.data() as Ride;
        const dateTime = normalizeDate(data.dateTime);
        return {
          ...data,
          id: docSnap.id,
          dateTime,
          status: resolveRideStatus({ status: data.status, dateTime }),
          photos: (data.photos || []).map((photo) => ({
            ...photo,
            uploadedAt: normalizeDate(photo.uploadedAt),
          })),
        };
      });
      setRides(list);
      setIsLoading(false);
    });

    const joinRequestsQuery = query(joinRequestsRef, orderBy('createdAt', 'desc'));
    const unsubJoinRequests = onSnapshot(joinRequestsQuery, (snap) => {
      const list = snap.docs.map((docSnap) => {
        const data = docSnap.data() as JoinRequest;
        return {
          ...data,
          id: docSnap.id,
          createdAt: normalizeDate(data.createdAt),
          decidedAt: data.decidedAt ? normalizeDate(data.decidedAt) : undefined,
        };
      });
      setJoinRequests(list);
    });

    const albumsQuery = query(albumsRef, orderBy('createdAt', 'desc'));
    const unsubAlbums = onSnapshot(albumsQuery, (snap) => {
      const list = snap.docs.map((docSnap) => {
        const data = docSnap.data() as CrewAlbum;
        return {
          ...data,
          id: docSnap.id,
          createdAt: normalizeDate(data.createdAt),
          updatedAt: data.updatedAt ? normalizeDate(data.updatedAt) : undefined,
          photos: (data.photos || []).map((photo) => ({
            ...photo,
            uploadedAt: normalizeDate(photo.uploadedAt),
          })),
        };
      });
      setAlbums(list);
    });

    const statsHistoryRef = collection(db, 'crews', crewId, 'statsHistory');
    const statsHistoryQuery = query(statsHistoryRef, orderBy('periodStart', 'desc'));
    const unsubStatsHistory = onSnapshot(statsHistoryQuery, (snap) => {
      const list = snap.docs.map((docSnap) => {
        const data = docSnap.data() as CrewStatsSnapshot;
        return {
          ...data,
          id: docSnap.id,
          periodStart: normalizeDate(data.periodStart),
          periodEnd: normalizeDate(data.periodEnd),
          createdAt: normalizeDate(data.createdAt),
        };
      });
      setStatsHistory(list);
    });

    return () => {
      unsubCrew();
      unsubMembers();
      unsubAnnouncements();
      unsubRides();
      unsubJoinRequests();
      unsubAlbums();
      unsubStatsHistory();
    };
  }, [crewId, user?.id]);

  const createAnnouncement = useCallback(async (announcement: Omit<Announcement, 'id' | 'createdAt'>) => {
    if (!crewId) throw new Error('No crew');
    assertCanManageAnnouncements();
    const announcementsRef = collection(db, 'crews', crewId, 'announcements');
    const docRef = doc(announcementsRef);

    let imageUrl = announcement.imageUrl;
    if (imageUrl) {
      imageUrl = await uploadImageIfNeeded(
        imageUrl,
        `crews/${crewId}/announcements/${docRef.id}.jpg`
      );
    }

    await setDoc(docRef, stripUndefined({
      ...announcement,
      id: docRef.id,
      imageUrl: imageUrl || null,
      likedBy: announcement.likedBy || [],
      createdAt: new Date().toISOString(),
    }));

    void trackAnalyticsEvent({
      eventName: 'announcement_create_success',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: '/create-announcement',
      properties: {
        announcementId: docRef.id,
        isPinned: !!announcement.isPinned,
        hasImage: Boolean(imageUrl),
      },
    });
  }, [crewId, assertCanManageAnnouncements, currentUser?.id]);

  const updateAnnouncement = useCallback(async (
    announcementId: string,
    updates: Partial<Pick<Announcement, 'title' | 'content' | 'isPinned' | 'link'>> & {
      imageUrl?: string | null;
      imageAttribution?: Announcement['imageAttribution'] | null;
    }
  ) => {
    if (!crewId) throw new Error('No crew');
    assertCanManageAnnouncements();
    const announcementRef = doc(db, 'crews', crewId, 'announcements', announcementId);

    let imageUrl = updates.imageUrl;
    if (imageUrl) {
      imageUrl = await uploadImageIfNeeded(
        imageUrl,
        `crews/${crewId}/announcements/${announcementId}.jpg`
      );
    }

    await updateDoc(announcementRef, stripUndefined({
      ...updates,
      imageUrl: imageUrl ?? updates.imageUrl,
    }));

    void trackAnalyticsEvent({
      eventName: 'announcement_update_success',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: '/create-announcement',
      properties: {
        announcementId: announcementId,
        isPinned: updates.isPinned ?? undefined,
        hasImage: Boolean(imageUrl ?? updates.imageUrl),
      },
    });
  }, [crewId, assertCanManageAnnouncements, currentUser?.id]);

  const deleteAnnouncement = useCallback(async (announcementId: string) => {
    if (!crewId) throw new Error('No crew');
    assertCanManageAnnouncements();
    await deleteStoragePath(`crews/${crewId}/announcements/${announcementId}.jpg`);
    await deleteDoc(doc(db, 'crews', crewId, 'announcements', announcementId));

    void trackAnalyticsEvent({
      eventName: 'announcement_delete_success',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: '/create-announcement',
      properties: { announcementId },
    });
  }, [crewId, assertCanManageAnnouncements, currentUser?.id]);

  const toggleAnnouncementLike = useCallback(async (announcementId: string) => {
    if (!crewId || !currentUser) throw new Error('No crew member');
    const announcement = announcements.find((item) => item.id === announcementId);
    if (!announcement) throw new Error('Announcement not found');
    const announcementRef = doc(db, 'crews', crewId, 'announcements', announcementId);
    const hasLiked = announcement.likedBy?.includes(currentUser.id);

    await updateDoc(announcementRef, {
      likedBy: hasLiked ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id),
    });

    void trackAnalyticsEvent({
      eventName: hasLiked ? 'announcement_unlike' : 'announcement_like',
      actorUserId: currentUser.id,
      crewId,
      route: '/home',
      properties: { announcementId },
    });
  }, [announcements, crewId, currentUser]);

  const createRide = useCallback(async (ride: Omit<Ride, 'id' | 'attendees' | 'checkedIn' | 'photos' | 'status'>) => {
    if (!crewId) throw new Error('No crew');
    assertCanManageRides();
    setIsCreatingRide(true);
    try {
      const ridesRef = collection(db, 'crews', crewId, 'rides');
      const docRef = doc(ridesRef);
      const hasCoords = Number.isFinite(ride.startLocation?.latitude) &&
        Number.isFinite(ride.startLocation?.longitude) &&
        Number.isFinite(ride.endLocation?.latitude) &&
        Number.isFinite(ride.endLocation?.longitude);
      const routeDistance = ride.routeDistanceMeters ? ride.routeDistanceMeters / 1609.344 : 0;
      const distanceAuto = routeDistance || (hasCoords
        ? calculateDistanceMiles(ride.startLocation, ride.endLocation)
        : ride.estimatedDistance);
      const coverNeedsUpload =
        !!ride.coverImage &&
        !ride.coverImage.startsWith('https://images.unsplash.com/') &&
        !ride.coverImage.startsWith('https://firebasestorage.googleapis.com/') &&
        !ride.coverImage.includes('.firebasestorage.app/');
      const initialCoverImage = coverNeedsUpload
        ? getDefaultRideCoverUri()
        : ride.coverImage || getDefaultRideCoverUri();
      await setDoc(docRef, stripUndefined({
        ...ride,
        estimatedDistance: Math.round((distanceAuto || 0) * 10) / 10 || ride.estimatedDistance,
        id: docRef.id,
        coverImage: initialCoverImage,
        attendees: ride.createdBy ? [ride.createdBy] : [],
        checkedIn: [],
        photos: [],
        status: 'upcoming',
      }));

      let finalCoverImage = initialCoverImage;
      if (coverNeedsUpload) {
        try {
          finalCoverImage = await uploadImageIfNeeded(
            ride.coverImage,
            `crews/${crewId}/rides/${docRef.id}/cover.jpg`
          );
          await updateDoc(docRef, { coverImage: finalCoverImage });
        } catch (error) {
          if (__DEV__) {
            console.log('[CrewProvider] Ride cover upload failed after ride save:', error);
          }
        }
      }

      void trackAnalyticsEvent({
        eventName: 'ride_create_success',
        actorUserId: currentUser?.id ?? null,
        crewId,
        route: '/create-ride',
        properties: {
          rideId: docRef.id,
          pace: ride.pace,
          estimatedDistance: Math.round((distanceAuto || 0) * 10) / 10 || ride.estimatedDistance || 0,
          hasCoverImage: Boolean(finalCoverImage),
        },
      });
      return docRef.id;
    } finally {
      setIsCreatingRide(false);
    }
  }, [crewId, assertCanManageRides, currentUser?.id]);

  const updateRide = useCallback(async (
    rideId: string,
    updates: Partial<Pick<Ride, 'title' | 'description' | 'startLocation' | 'endLocation' | 'dateTime' | 'estimatedDuration' | 'estimatedDistance' | 'routeCoordinates' | 'routeDistanceMeters' | 'routeDurationSeconds' | 'pace' | 'notes' | 'coverImage' | 'coverAttribution'>>
  ) => {
    if (!crewId) throw new Error('No crew');
    assertCanManageRides();
    const rideRef = doc(db, 'crews', crewId, 'rides', rideId);

    let estimatedDistance = updates.estimatedDistance;
    if (updates.routeDistanceMeters) {
      estimatedDistance = Math.round((updates.routeDistanceMeters / 1609.344) * 10) / 10;
    } else if (
      updates.startLocation &&
      updates.endLocation &&
      Number.isFinite(updates.startLocation.latitude) &&
      Number.isFinite(updates.startLocation.longitude) &&
      Number.isFinite(updates.endLocation.latitude) &&
      Number.isFinite(updates.endLocation.longitude)
    ) {
      estimatedDistance =
        Math.round(
          calculateDistanceMiles(updates.startLocation, updates.endLocation) * 10
        ) / 10;
    }

    let coverImage = updates.coverImage;
    if (coverImage) {
      coverImage = await uploadImageIfNeeded(
        coverImage,
        `crews/${crewId}/rides/${rideId}/cover.jpg`
      );
    }

    await updateDoc(rideRef, stripUndefined({
      ...updates,
      estimatedDistance,
      coverImage: coverImage ?? updates.coverImage,
    }));

    void trackAnalyticsEvent({
      eventName: 'ride_update_success',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: '/create-ride',
      properties: {
        rideId,
        pace: updates.pace ?? undefined,
        hasCoverImage: Boolean(coverImage ?? updates.coverImage),
      },
    });
  }, [crewId, assertCanManageRides, currentUser?.id]);

  const deleteRide = useCallback(async (rideId: string) => {
    if (!crewId) throw new Error('No crew');
    assertCanManageRides();
    const ride = rides.find((item) => item.id === rideId);
    await Promise.all([
      deleteStoragePath(`crews/${crewId}/rides/${rideId}/cover.jpg`),
      ...(ride?.photos || []).map((photo) =>
        deleteStoragePath(`crews/${crewId}/rides/${rideId}/photos/${photo.id}.jpg`)
      ),
    ]);
    await deleteDoc(doc(db, 'crews', crewId, 'rides', rideId));

    void trackAnalyticsEvent({
      eventName: 'ride_delete_success',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: '/create-ride',
      properties: { rideId },
    });
  }, [crewId, rides, assertCanManageRides, currentUser?.id]);

  const cancelRide = useCallback(async (rideId: string) => {
    if (!crewId) throw new Error('No crew');
    assertCanManageRides();
    await updateDoc(doc(db, 'crews', crewId, 'rides', rideId), {
      status: 'cancelled',
    });

    void trackAnalyticsEvent({
      eventName: 'ride_cancel_success',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: `/ride/${rideId}`,
      properties: { rideId },
    });
  }, [crewId, assertCanManageRides, currentUser?.id]);

  const reopenRide = useCallback(async (rideId: string) => {
    if (!crewId) throw new Error('No crew');
    assertCanManageRides();
    await updateDoc(doc(db, 'crews', crewId, 'rides', rideId), {
      status: 'upcoming',
    });

    void trackAnalyticsEvent({
      eventName: 'ride_reopen_success',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: `/ride/${rideId}`,
      properties: { rideId },
    });
  }, [crewId, assertCanManageRides, currentUser?.id]);

  const joinRide = useCallback(async (rideId: string) => {
    if (!crewId || !user?.id) return;
    await updateDoc(doc(db, 'crews', crewId, 'rides', rideId), {
      attendees: arrayUnion(user.id),
    });

    void trackAnalyticsEvent({
      eventName: 'ride_join',
      actorUserId: user.id,
      crewId,
      route: `/ride/${rideId}`,
      properties: { rideId },
    });
  }, [crewId, user?.id]);

  const leaveRide = useCallback(async (rideId: string) => {
    if (!crewId || !user?.id) return;
    await updateDoc(doc(db, 'crews', crewId, 'rides', rideId), {
      attendees: arrayRemove(user.id),
      checkedIn: arrayRemove(user.id),
    });

    void trackAnalyticsEvent({
      eventName: 'ride_leave',
      actorUserId: user.id,
      crewId,
      route: `/ride/${rideId}`,
      properties: { rideId },
    });
  }, [crewId, user?.id]);

  const checkIn = useCallback(async (rideId: string) => {
    if (!crewId || !user?.id) return;
    await updateDoc(doc(db, 'crews', crewId, 'rides', rideId), {
      checkedIn: arrayUnion(user.id),
    });

    void trackAnalyticsEvent({
      eventName: 'ride_check_in',
      actorUserId: user.id,
      crewId,
      route: `/ride/${rideId}`,
      properties: { rideId },
    });
  }, [crewId, user?.id]);

  const leaveCrew = useCallback(async () => {
    if (!crewId || !currentUser) throw new Error('No crew');
    const callable = httpsCallable(functions, 'leaveCrew');
    const result = await callable();
    const data = result.data as {
      crewId: string | null;
      crewName: string | null;
      ownershipTransferred: boolean;
      crewArchived: boolean;
      leftAsOwner: boolean;
      shouldManageSubscription: boolean;
      nextOwnerId: string | null;
      nextOwnerName: string | null;
    };

    void trackAnalyticsEvent({
      eventName: 'crew_leave_success',
      actorUserId: currentUser.id,
      crewId: data.crewId ?? crewId,
      route: '/(tabs)/more',
      properties: {
        crewName: data.crewName ?? crew?.name ?? '',
        ownershipTransferred: data.ownershipTransferred,
        crewArchived: data.crewArchived,
        leftAsOwner: data.leftAsOwner,
        shouldManageSubscription: data.shouldManageSubscription,
      },
    });
    return result.data as {
      crewId: string | null;
      crewName: string | null;
      ownershipTransferred: boolean;
      crewArchived: boolean;
      leftAsOwner: boolean;
      shouldManageSubscription: boolean;
      nextOwnerId: string | null;
      nextOwnerName: string | null;
    };
  }, [crewId, currentUser]);

  const getInviteCode = useCallback(async () => {
    if (!crewId || !currentUser) throw new Error('No crew');
    const callable = httpsCallable(functions, 'getCrewInviteCode');
    try {
      const result = await callable();
      return (result.data as { inviteCode?: string }).inviteCode || '';
    } catch (error: any) {
      const errorCode = String(error?.code ?? '');
      const errorMessage = String(error?.message ?? '');
      const isMissingFunction =
        errorCode === 'functions/not-found' ||
        errorCode === 'not-found' ||
        errorMessage.includes('not-found');

      if (isMissingFunction) {
        console.log(
          '[CrewProvider] getCrewInviteCode is not deployed yet. Invite code actions are disabled until functions are deployed.'
        );
        return '';
      }

      throw error;
    }
  }, [crewId, currentUser]);

  const getInviteSettings = useCallback(async (): Promise<InviteCodeSettings> => {
    if (!crewId || !currentUser) throw new Error('No crew');
    assertAdmin();
    const callable = httpsCallable(functions, 'getCrewInviteCode');
    try {
      const result = await callable();
      const data = result.data as { inviteCode?: string; expiresAt?: string | null };
      return {
        inviteCode: data.inviteCode || '',
        expiresAt: data.expiresAt ?? null,
      };
    } catch (callableError) {
      try {
        const settingsRef = doc(db, 'crews', crewId, 'private', 'settings');
        const snap = await getDoc(settingsRef);
        if (snap.exists()) {
          const data = snap.data() as { inviteCode?: string; expiresAt?: string | null };
          return {
            inviteCode: data.inviteCode || '',
            expiresAt: data.expiresAt ?? null,
          };
        }

        const inviteCode = generateInviteCode();
        const now = new Date().toISOString();
        await setDoc(settingsRef, { inviteCode, expiresAt: null, updatedAt: now });
        await setDoc(doc(db, 'crewInviteCodes', inviteCode), {
          code: inviteCode,
          crewId,
          expiresAt: null,
          createdBy: currentUser.id,
          createdAt: now,
        });
        return { inviteCode, expiresAt: null };
      } catch {
        throw callableError;
      }
    }
  }, [crewId, currentUser, assertAdmin]);

  const updateInviteSettings = useCallback(async ({
    inviteCode,
    expiresAt,
  }: {
    inviteCode?: string;
    expiresAt?: string | null;
  }): Promise<InviteCodeSettings> => {
    if (!crewId) throw new Error('No crew');
    assertAdmin();
    const callable = httpsCallable(functions, 'setCrewInviteCode');
    try {
      const result = await callable({ inviteCode, expiresAt: expiresAt ?? null });
      const data = result.data as { inviteCode?: string; expiresAt?: string | null };
      return {
        inviteCode: data.inviteCode || '',
        expiresAt: data.expiresAt ?? null,
      };
    } catch (callableError) {
      try {
        if (!currentUser) throw new Error('No crew');

        const nextCode = (inviteCode || generateInviteCode()).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (nextCode.length < 4 || nextCode.length > 16) throw new Error('INVITE_CODE_LENGTH');

        const settingsRef = doc(db, 'crews', crewId, 'private', 'settings');
        const lookupRef = doc(db, 'crewInviteCodes', nextCode);
        const now = new Date().toISOString();
        await runTransaction(db, async (transaction) => {
          const lookupSnap = await transaction.get(lookupRef);
          if (lookupSnap.exists()) {
            const data = lookupSnap.data() as { crewId?: string };
            if (data.crewId && data.crewId !== crewId) throw new Error('INVITE_CODE_TAKEN');
          }

          transaction.set(settingsRef, {
            inviteCode: nextCode,
            expiresAt: expiresAt ?? null,
            updatedAt: now,
          }, { merge: true });
          transaction.set(lookupRef, {
            code: nextCode,
            crewId,
            expiresAt: expiresAt ?? null,
            createdBy: currentUser.id,
            createdAt: now,
          }, { merge: true });
        });

        return { inviteCode: nextCode, expiresAt: expiresAt ?? null };
      } catch {
        throw callableError;
      }
    }
  }, [crewId, assertAdmin, currentUser]);

  const removeMember = useCallback(async (memberId: string) => {
    if (!crewId) throw new Error('No crew');
    assertAdmin();
    const callable = httpsCallable(functions, 'removeCrewMember');
    await callable({ memberId });

    void trackAnalyticsEvent({
      eventName: 'crew_member_removed',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: '/members',
      properties: {
        memberId,
        action: 'remove_member',
      },
    });
  }, [crewId, assertAdmin]);

  const setMemberRole = useCallback(async (memberId: string, role: CrewMember['role']) => {
    if (!crewId) throw new Error('No crew');
    assertAdmin();
    const callable = httpsCallable(functions, 'setCrewMemberRole');
    await callable({ memberId, role });

    void trackAnalyticsEvent({
      eventName: 'crew_member_role_changed',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: '/members',
      properties: {
        memberId,
        role,
        action: 'set_member_role',
      },
    });
  }, [crewId, assertAdmin]);

  const setMemberLeadership = useCallback(async (
    memberId: string,
    updates: {
      role?: CrewMember['role'];
      leadershipTitle?: string;
      permissions?: CrewMember['permissions'];
    }
  ) => {
    if (!crewId) throw new Error('No crew');
    assertAdmin();
    const callable = httpsCallable(functions, 'setCrewMemberLeadership');
    await callable({ memberId, ...updates });

    void trackAnalyticsEvent({
      eventName: 'crew_member_role_changed',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: '/members',
      properties: {
        memberId,
        role: updates.role ?? null,
        leadershipTitle: updates.leadershipTitle ?? null,
        permissions: updates.permissions ? JSON.stringify(updates.permissions) : null,
        action: 'set_member_leadership',
      },
    });
  }, [crewId, assertAdmin, currentUser?.id]);

  const approveJoinRequest = useCallback(async (request: JoinRequest) => {
    if (!crewId) throw new Error('No crew');
    assertCanManageJoinRequests();
    const callable = httpsCallable(functions, 'approveJoinRequest');
    try {
      await callable({ requestId: request.id });
    } catch (callableError) {
      try {
        const joinRequestRef = doc(db, 'crews', crewId, 'joinRequests', request.id);
        const targetUserRef = doc(db, 'users', request.userId);
        const targetMemberRef = doc(db, 'crews', crewId, 'members', request.userId);
        const crewRef = doc(db, 'crews', crewId);
        await runTransaction(db, async (transaction) => {
          const [joinRequestSnap, targetUserSnap, targetMemberSnap] = await Promise.all([
            transaction.get(joinRequestRef),
            transaction.get(targetUserRef),
            transaction.get(targetMemberRef),
          ]);
          if (!joinRequestSnap.exists()) throw new Error('JOIN_REQUEST_NOT_FOUND');
          if (!targetUserSnap.exists()) throw new Error('USER_NOT_FOUND');

          const joinRequest = joinRequestSnap.data() as JoinRequest;
          const targetUser = targetUserSnap.data() as Partial<CrewMember> & { crewId?: string | null };
          if (joinRequest.status === 'approved') return;
          if (targetUser.crewId && targetUser.crewId !== crewId) throw new Error('USER_ALREADY_IN_CREW');

          if (!targetMemberSnap.exists()) {
            transaction.set(targetMemberRef, {
              id: joinRequest.userId,
              email: targetUser.email ?? joinRequest.userEmail ?? '',
              name: targetUser.name ?? joinRequest.userName ?? 'Member',
              avatar: targetUser.avatar ?? joinRequest.userAvatar ?? '',
              bike: targetUser.bike ?? '',
              role: 'member',
              joinedCrewAt: new Date().toISOString(),
              ridesAttended: 0,
              milesTraveled: 0,
            });
            transaction.set(crewRef, { memberCount: increment(1) }, { merge: true });
          }

          transaction.set(targetUserRef, {
            crewId,
            role: 'member',
            pendingCrewId: null,
          }, { merge: true });
          transaction.set(joinRequestRef, {
            status: 'approved',
            decidedAt: new Date().toISOString(),
            decidedBy: currentUser?.id ?? null,
          }, { merge: true });
        });
      } catch {
        throw callableError;
      }
    }

    void trackAnalyticsEvent({
      eventName: 'crew_join_request_resolved',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: '/join-crew',
      properties: {
        requestId: request.id,
        action: 'approve_join_request',
      },
    });
  }, [crewId, assertCanManageJoinRequests, currentUser?.id]);

  const denyJoinRequest = useCallback(async (request: JoinRequest) => {
    if (!crewId) throw new Error('No crew');
    assertCanManageJoinRequests();
    const callable = httpsCallable(functions, 'denyJoinRequest');
    try {
      await callable({ requestId: request.id });
    } catch (callableError) {
      try {
        await runTransaction(db, async (transaction) => {
          transaction.set(doc(db, 'users', request.userId), {
            pendingCrewId: null,
          }, { merge: true });
          transaction.set(doc(db, 'crews', crewId, 'joinRequests', request.id), {
            status: 'denied',
            decidedAt: new Date().toISOString(),
            decidedBy: currentUser?.id ?? null,
          }, { merge: true });
        });
      } catch {
        throw callableError;
      }
    }

    void trackAnalyticsEvent({
      eventName: 'crew_join_request_resolved',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: '/join-crew',
      properties: {
        requestId: request.id,
        action: 'deny_join_request',
      },
    });
  }, [crewId, assertCanManageJoinRequests, currentUser?.id]);

  const updateCrewSettings = useCallback(async (updates: Partial<Pick<Crew, 'name' | 'description' | 'logoUrl' | 'requiresApproval'>>) => {
    if (!crewId) throw new Error('No crew');
    assertAdmin();
    assertAdminActive();

    const callable = httpsCallable(functions, 'updateCrewSettings');
    try {
      await callable({});
    } catch (error) {
      if (__DEV__) {
        console.log('[CrewProvider] Crew settings preflight callable failed:', error);
      }
    }

    let logoUrl = updates.logoUrl;
    if (logoUrl) {
      logoUrl = await uploadImageIfNeeded(logoUrl, `crews/${crewId}/logo.jpg`);
    }

    const payload = stripUndefined({
      ...updates,
      logoUrl: logoUrl ?? updates.logoUrl,
      nameLower: updates.name ? updates.name.trim().toLowerCase() : undefined,
    });
    try {
      await callable(payload);
    } catch (callableError) {
      await updateDoc(doc(db, 'crews', crewId), payload).catch(() => {
        throw callableError;
      });
    }

    void trackAnalyticsEvent({
      eventName: 'crew_settings_updated',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: '/(tabs)/more',
      properties: {
        action: 'update_crew_settings',
        crewName: updates.name ?? crew?.name ?? '',
        hasLogo: Boolean(logoUrl ?? updates.logoUrl),
        requiresApproval: updates.requiresApproval ?? undefined,
      },
    });
  }, [crewId, assertAdminActive, assertAdmin]);

  const addPhoto = useCallback(async ({ rideId, imageUrl }: { rideId: string; imageUrl: string }) => {
    if (!crewId || !currentUser) return;

    const photoId = `photo-${Date.now()}`;
    const uploadedUrl = await uploadImageIfNeeded(
      imageUrl,
      `crews/${crewId}/rides/${rideId}/photos/${photoId}.jpg`
    );

    const newPhoto: RidePhoto = {
      id: photoId,
      rideId,
      uploadedBy: currentUser.id,
      uploadedByName: currentUser.name,
      imageUrl: uploadedUrl,
      uploadedAt: new Date().toISOString(),
    };

    await updateDoc(doc(db, 'crews', crewId, 'rides', rideId), {
      photos: arrayUnion(newPhoto),
    });
  }, [crewId, currentUser]);

  const createAlbum = useCallback(async ({
    title,
    description,
    coverImage,
  }: {
    title: string;
    description?: string;
    coverImage?: string;
  }) => {
    if (!crewId || !currentUser) throw new Error('No crew');
    if (!canManageAlbums) throw new Error('NOT_AUTHORIZED');
    const albumsRef = collection(db, 'crews', crewId, 'albums');
    const docRef = doc(albumsRef);
    let uploadedCover = coverImage || '';
    if (uploadedCover) {
      uploadedCover = await uploadImageIfNeeded(
        uploadedCover,
        `crews/${crewId}/albums/${docRef.id}/cover.jpg`
      );
    }

    await setDoc(docRef, stripUndefined({
      id: docRef.id,
      crewId,
      title: title.trim(),
      description: description?.trim() || '',
      coverImage: uploadedCover || null,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      photos: [],
    }));

    return docRef.id;
  }, [canManageAlbums, crewId, currentUser]);

  const addAlbumPhoto = useCallback(async ({ albumId, imageUrl }: { albumId: string; imageUrl: string }) => {
    if (!crewId || !currentUser) throw new Error('No crew member');

    const photoId = `photo-${Date.now()}`;
    const uploadedUrl = await uploadImageIfNeeded(
      imageUrl,
      `crews/${crewId}/albums/${albumId}/photos/${photoId}.jpg`
    );

    const newPhoto: RidePhoto = {
      id: photoId,
      rideId: albumId,
      uploadedBy: currentUser.id,
      uploadedByName: currentUser.name,
      imageUrl: uploadedUrl,
      uploadedAt: new Date().toISOString(),
    };

    await updateDoc(doc(db, 'crews', crewId, 'albums', albumId), {
      photos: arrayUnion(newPhoto),
      updatedAt: new Date().toISOString(),
    });
  }, [crewId, currentUser]);

  const upcomingRides = useMemo(() =>
    rides
      .filter((ride) => ride.status === 'upcoming')
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()),
    [rides]
  );

  const pastRides = useMemo(() =>
    rides
      .filter((ride) => ride.status === 'completed')
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()),
    [rides]
  );

  const crewStats: CrewStats = useMemo(() => {
    const totalRides = rides.length;
    const totalMiles = rides.reduce((sum, ride) => sum + (ride.estimatedDistance || 0), 0);
    const ridePhotos = rides.reduce((sum, ride) => sum + (ride.photos?.length || 0), 0);
    const albumPhotos = albums.reduce((sum, album) => sum + (album.photos?.length || 0), 0);
    const totalPhotos = ridePhotos + albumPhotos;
    const totalMembers = members.length;

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const ridesThisMonth = rides.filter((ride) => {
      const date = new Date(ride.dateTime);
      return date.getMonth() === month && date.getFullYear() === year;
    });

    const milesThisMonth = ridesThisMonth.reduce((sum, ride) => sum + (ride.estimatedDistance || 0), 0);

    return {
      totalRides,
      totalMiles,
      totalPhotos,
      totalMembers,
      ridesThisMonth: ridesThisMonth.length,
      milesThisMonth,
    };
  }, [albums, rides, members]);

  const memberStats: MemberStats = useMemo(() => {
    if (!currentUser) {
      return {
        ridesAttended: 0,
        milesTraveled: 0,
        currentStreak: 0,
        longestStreak: 0,
        memberSince: new Date().toISOString(),
      };
    }

    const completedRides = rides
      .filter((ride) => resolveRideStatus(ride) === 'completed')
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    const attendedRides = completedRides.filter((ride) => ride.attendees?.includes(currentUser.id));
    const ridesAttended = attendedRides.length;
    const milesTraveled = attendedRides.reduce((sum, ride) => sum + (ride.estimatedDistance || 0), 0);
    let longestStreak = 0;
    let runningStreak = 0;
    completedRides.forEach((ride) => {
      if (ride.attendees?.includes(currentUser.id)) {
        runningStreak += 1;
        longestStreak = Math.max(longestStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    });
    let currentStreak = 0;
    for (let index = completedRides.length - 1; index >= 0; index -= 1) {
      if (!completedRides[index].attendees?.includes(currentUser.id)) break;
      currentStreak += 1;
    }

    return {
      ridesAttended,
      milesTraveled,
      currentStreak,
      longestStreak,
      memberSince: currentUser.joinedCrewAt || currentUser.joinedAt || new Date().toISOString(),
    };
  }, [currentUser, rides]);

  const getRideById = useCallback((id: string) => rides.find((ride) => ride.id === id), [rides]);
  const getAnnouncementById = useCallback(
    (id: string) => announcements.find((announcement) => announcement.id === id),
    [announcements]
  );
  const getMemberById = useCallback((id: string) => {
    const visibleMember = members.find((member) => member.id === id);
    if (visibleMember) return visibleMember;
    if (currentUser?.id === id) return currentUser;
    return undefined;
  }, [currentUser, members]);
  const getAlbumById = useCallback((id: string) => albums.find((album) => album.id === id), [albums]);

  return {
    currentUser,
    crew,
    members,
    announcements,
    rides,
    albums,
    statsHistory,
    joinRequests,
    upcomingRides,
    pastRides,
    crewStats,
    memberStats,
    isAdmin,
    isOfficer,
    isOwner,
    isBillingRequired,
    canUseAdminTools,
    canManageRides,
    canManageAnnouncements,
    canManageAlbums,
    canManageJoinRequests,
    canPost,
    isSubscriptionActive,
    isLoading,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    toggleAnnouncementLike,
    createRide,
    updateRide,
    deleteRide,
    cancelRide,
    reopenRide,
    joinRide,
    leaveRide,
    checkIn,
    leaveCrew,
    getInviteCode,
    getInviteSettings,
    updateInviteSettings,
    addPhoto,
    createAlbum,
    addAlbumPhoto,
    removeMember,
    setMemberRole,
    setMemberLeadership,
    approveJoinRequest,
    denyJoinRequest,
    updateCrewSettings,
    getRideById,
    getAnnouncementById,
    getMemberById,
    getAlbumById,
    isCreatingRide,
  };
});

export function useRide(rideId: string) {
  const { getRideById, members } = useCrew();
  const ride = getRideById(rideId);
  const attendeeMembers = useMemo(() => {
    if (!ride) return [];
    return members.filter((member) => ride.attendees.includes(member.id));
  }, [ride, members]);

  return { ride, attendeeMembers };
}
