import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useMemo, useCallback, useState } from 'react';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
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
} from '@/types';
import { calculateDistanceMiles } from '@/utils/helpers';

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

async function uploadImageIfNeeded(uri: string, path: string) {
  if (!uri) return uri;
  if (uri.startsWith('http')) return uri;
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, path);
  const contentType =
    blob.type || (path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
  await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(storageRef);
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
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingRide, setIsCreatingRide] = useState(false);
  const [statsHistory, setStatsHistory] = useState<CrewStatsSnapshot[]>([]);

  const isAdmin = currentUser?.role === 'admin';
  const isOfficer = currentUser?.role === 'officer';
  const isDeveloperSupport = !!currentUser?.isDeveloperSupport;
  const isOwner = !!currentUser?.id && crew?.ownerId === currentUser.id;
  const isSubscriptionActive =
    crew?.subscriptionStatus === 'active' || crew?.subscriptionStatus === 'trialing';
  const canPost = isDeveloperSupport || isOwner || isAdmin || (isOfficer && isSubscriptionActive);

  const assertAdminActive = useCallback(() => {
    if (isDeveloperSupport) return;
    if (isOwner) return;
    if (!isSubscriptionActive) {
      throw new Error('SUBSCRIPTION_INACTIVE');
    }
  }, [isDeveloperSupport, isOwner, isSubscriptionActive]);

  const assertAdminOrOfficer = useCallback(() => {
    if (!isAdmin && !isOfficer) {
      throw new Error('NOT_AUTHORIZED');
    }
  }, [isAdmin, isOfficer]);

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
      unsubStatsHistory();
    };
  }, [crewId, user?.id]);

  const createAnnouncement = useCallback(async (announcement: Omit<Announcement, 'id' | 'createdAt'>) => {
    if (!crewId) throw new Error('No crew');
    assertAdminOrOfficer();
    assertAdminActive();
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
  }, [crewId, assertAdminActive, assertAdminOrOfficer]);

  const updateAnnouncement = useCallback(async (
    announcementId: string,
    updates: Partial<Pick<Announcement, 'title' | 'content' | 'isPinned' | 'link'>> & {
      imageUrl?: string | null;
      imageAttribution?: Announcement['imageAttribution'] | null;
    }
  ) => {
    if (!crewId) throw new Error('No crew');
    assertAdminOrOfficer();
    assertAdminActive();
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
  }, [crewId, assertAdminActive, assertAdminOrOfficer]);

  const deleteAnnouncement = useCallback(async (announcementId: string) => {
    if (!crewId) throw new Error('No crew');
    assertAdminOrOfficer();
    assertAdminActive();
    await deleteStoragePath(`crews/${crewId}/announcements/${announcementId}.jpg`);
    await deleteDoc(doc(db, 'crews', crewId, 'announcements', announcementId));

    void trackAnalyticsEvent({
      eventName: 'announcement_delete_success',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: '/create-announcement',
      properties: { announcementId },
    });
  }, [crewId, assertAdminActive, assertAdminOrOfficer, currentUser?.id]);

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
    assertAdminOrOfficer();
    assertAdminActive();
    setIsCreatingRide(true);
    try {
      const ridesRef = collection(db, 'crews', crewId, 'rides');
      const docRef = doc(ridesRef);
      const hasCoords = Number.isFinite(ride.startLocation?.latitude) &&
        Number.isFinite(ride.startLocation?.longitude) &&
        Number.isFinite(ride.endLocation?.latitude) &&
        Number.isFinite(ride.endLocation?.longitude);
      const distanceAuto = hasCoords
        ? calculateDistanceMiles(ride.startLocation, ride.endLocation)
        : ride.estimatedDistance;
      const coverImage = await uploadImageIfNeeded(
        ride.coverImage,
        `crews/${crewId}/rides/${docRef.id}/cover.jpg`
      );
      await setDoc(docRef, stripUndefined({
        ...ride,
        estimatedDistance: Math.round((distanceAuto || 0) * 10) / 10 || ride.estimatedDistance,
        id: docRef.id,
        coverImage,
        attendees: ride.createdBy ? [ride.createdBy] : [],
        checkedIn: [],
        photos: [],
        status: 'upcoming',
      }));

      void trackAnalyticsEvent({
        eventName: 'ride_create_success',
        actorUserId: currentUser?.id ?? null,
        crewId,
        route: '/create-ride',
        properties: {
          rideId: docRef.id,
          pace: ride.pace,
          estimatedDistance: Math.round((distanceAuto || 0) * 10) / 10 || ride.estimatedDistance || 0,
          hasCoverImage: Boolean(coverImage),
        },
      });
    } finally {
      setIsCreatingRide(false);
    }
  }, [crewId, assertAdminActive, assertAdminOrOfficer]);

  const updateRide = useCallback(async (
    rideId: string,
    updates: Partial<Pick<Ride, 'title' | 'description' | 'startLocation' | 'endLocation' | 'dateTime' | 'estimatedDuration' | 'estimatedDistance' | 'pace' | 'notes' | 'coverImage' | 'coverAttribution'>>
  ) => {
    if (!crewId) throw new Error('No crew');
    assertAdminOrOfficer();
    assertAdminActive();
    const rideRef = doc(db, 'crews', crewId, 'rides', rideId);

    let estimatedDistance = updates.estimatedDistance;
    if (
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
  }, [crewId, assertAdminActive, assertAdminOrOfficer]);

  const deleteRide = useCallback(async (rideId: string) => {
    if (!crewId) throw new Error('No crew');
    assertAdminOrOfficer();
    assertAdminActive();
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
  }, [crewId, rides, assertAdminActive, assertAdminOrOfficer, currentUser?.id]);

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
    const result = await callable();
    const data = result.data as { inviteCode?: string; expiresAt?: string | null };
    return {
      inviteCode: data.inviteCode || '',
      expiresAt: data.expiresAt ?? null,
    };
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
    const result = await callable({ inviteCode, expiresAt: expiresAt ?? null });
    const data = result.data as { inviteCode?: string; expiresAt?: string | null };
    return {
      inviteCode: data.inviteCode || '',
      expiresAt: data.expiresAt ?? null,
    };
  }, [crewId, assertAdmin]);

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

  const approveJoinRequest = useCallback(async (request: JoinRequest) => {
    if (!crewId) throw new Error('No crew');
    assertAdminOrOfficer();
    const callable = httpsCallable(functions, 'approveJoinRequest');
    await callable({ requestId: request.id });

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
  }, [crewId, assertAdminOrOfficer]);

  const denyJoinRequest = useCallback(async (request: JoinRequest) => {
    if (!crewId) throw new Error('No crew');
    assertAdminOrOfficer();
    const callable = httpsCallable(functions, 'denyJoinRequest');
    await callable({ requestId: request.id });

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
  }, [crewId, assertAdminOrOfficer]);

  const updateCrewSettings = useCallback(async (updates: Partial<Pick<Crew, 'name' | 'description' | 'logoUrl' | 'isDiscoverable' | 'requiresApproval'>>) => {
    if (!crewId) throw new Error('No crew');
    assertAdmin();
    assertAdminActive();
    const crewRef = doc(db, 'crews', crewId);

    let logoUrl = updates.logoUrl;
    if (logoUrl) {
      logoUrl = await uploadImageIfNeeded(logoUrl, `crews/${crewId}/logo.jpg`);
    }

    const nameLower = updates.name ? updates.name.toLowerCase() : undefined;
    await updateDoc(crewRef, stripUndefined({
      ...updates,
      logoUrl: logoUrl ?? updates.logoUrl,
      nameLower,
    }));

    void trackAnalyticsEvent({
      eventName: 'crew_settings_updated',
      actorUserId: currentUser?.id ?? null,
      crewId,
      route: '/(tabs)/more',
      properties: {
        action: 'update_crew_settings',
        crewName: updates.name ?? crew?.name ?? '',
        hasLogo: Boolean(logoUrl ?? updates.logoUrl),
        isDiscoverable: updates.isDiscoverable ?? undefined,
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
    const totalPhotos = rides.reduce((sum, ride) => sum + (ride.photos?.length || 0), 0);
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
  }, [rides, members]);

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
  const getMemberById = useCallback((id: string) => members.find((member) => member.id === id), [members]);

  return {
    currentUser,
    crew,
    members,
    announcements,
    rides,
    statsHistory,
    joinRequests,
    upcomingRides,
    pastRides,
    crewStats,
    memberStats,
    isAdmin,
    isOfficer,
    isOwner,
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
    joinRide,
    leaveRide,
    checkIn,
    leaveCrew,
    getInviteCode,
    getInviteSettings,
    updateInviteSettings,
    addPhoto,
    removeMember,
    setMemberRole,
    approveJoinRequest,
    denyJoinRequest,
    updateCrewSettings,
    getRideById,
    getAnnouncementById,
    getMemberById,
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
