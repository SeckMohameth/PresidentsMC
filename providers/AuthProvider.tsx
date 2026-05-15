import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  updateProfile as updateFirebaseProfile,
  sendPasswordResetEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateEmail,
  updatePassword,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useRevenueCat } from '@/providers/RevenueCatProvider';
import { auth, db, functions, storage } from '@/utils/firebase';
import SafeAsyncStorage from '@/utils/safeAsyncStorage';
import { UserPreferences } from '@/types';
import {
  CLUB_DESCRIPTION,
  CLUB_ID,
  CLUB_NAME,
  isDeveloperAdminEmail,
  isInitialOwnerEmail,
} from '@/constants/club';

export type AuthStatus =
  | 'loading'
  | 'onboarding'
  | 'unauthenticated'
  | 'feature_onboarding'
  | 'authenticated'
  | 'needs_crew';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string;
  emailVerified?: boolean;
}

interface UserProfile extends AuthUser {
  crewId?: string | null;
  role?: 'admin' | 'officer' | 'member';
  preferences?: UserPreferences;
  lastActiveAt?: string;
  pendingCrewId?: string | null;
  hasFeatureOnboarded?: boolean;
}

const STORAGE_KEYS = {
  HAS_ONBOARDED: 'has_onboarded',
  HAS_FEATURE_ONBOARDED: 'has_feature_onboarded',
};

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop';
const DEFAULT_PREFERENCES: UserPreferences = {
  pushEnabled: true,
  announcements: true,
  rides: true,
  joinRequests: true,
};

function generateInviteCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function ensureSingleClubOwner(profile: {
  id: string;
  email: string;
  name: string;
  avatar: string;
}) {
  const inviteCode = generateInviteCode();
  const crewRef = doc(db, 'crews', CLUB_ID);
  const crewSnap = await getDoc(crewRef);
  const now = new Date().toISOString();

  if (!crewSnap.exists()) {
    await setDoc(crewRef, {
      id: CLUB_ID,
      name: CLUB_NAME,
      description: CLUB_DESCRIPTION,
      nameLower: CLUB_NAME.toLowerCase(),
      logoUrl: '',
      isDiscoverable: false,
      requiresApproval: true,
      coverImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop',
      createdAt: now,
      memberCount: 1,
      totalRides: 0,
      totalMiles: 0,
      totalPhotos: 0,
      ownerId: profile.id,
      subscriptionOwnerId: profile.id,
      subscriptionStatus: 'inactive',
      status: 'active',
      archivedAt: null,
      purgeAt: null,
    });

    await setDoc(doc(db, 'crews', CLUB_ID, 'private', 'settings'), {
      inviteCode,
      expiresAt: null,
      updatedAt: now,
    });

    await setDoc(doc(db, 'crewInviteCodes', inviteCode), {
      code: inviteCode,
      crewId: CLUB_ID,
      expiresAt: null,
      createdBy: profile.id,
      createdAt: now,
    });
  }

  await setDoc(doc(db, 'crews', CLUB_ID, 'members', profile.id), {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    avatar: profile.avatar,
    role: 'admin',
    joinedCrewAt: now,
    ridesAttended: 0,
    milesTraveled: 0,
  }, { merge: true });

  await setDoc(doc(db, 'users', profile.id), {
    crewId: CLUB_ID,
    role: 'admin',
    pendingCrewId: null,
  }, { merge: true });
}

async function ensureDeveloperSupportAdmin(profile: {
  id: string;
  email: string;
  name: string;
  avatar: string;
}) {
  const now = new Date().toISOString();
  await setDoc(doc(db, 'crews', CLUB_ID, 'members', profile.id), {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    avatar: profile.avatar,
    role: 'admin',
    isDeveloperSupport: true,
    joinedCrewAt: now,
    ridesAttended: 0,
    milesTraveled: 0,
  }, { merge: true });

  await setDoc(doc(db, 'users', profile.id), {
    crewId: CLUB_ID,
    role: 'admin',
    pendingCrewId: null,
  }, { merge: true });
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const { isConfigured: isRevenueCatConfigured, loginUser, logoutUser } = useRevenueCat();
  const loginUserRef = useRef(loginUser);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const [hasCrew, setHasCrew] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isJoiningCrew, setIsJoiningCrew] = useState(false);
  const [isCreatingCrew, setIsCreatingCrew] = useState(false);

  useEffect(() => {
    loginUserRef.current = loginUser;
  }, [loginUser]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      setIsLoading(true);

      const storedOnboarded = await SafeAsyncStorage.getItem(STORAGE_KEYS.HAS_ONBOARDED);
      setHasOnboarded(storedOnboarded === 'true');

      if (!fbUser) {
        if (unsubscribeProfile) unsubscribeProfile();
        setProfile(null);
        setHasCrew(false);
        setIsLoading(false);
        return;
      }

      const userRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const name = fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
        const avatar = fbUser.photoURL || DEFAULT_AVATAR;
        const isOwner = isInitialOwnerEmail(fbUser.email);
        const isDeveloperAdmin = isDeveloperAdminEmail(fbUser.email);
        await setDoc(userRef, {
          id: fbUser.uid,
          email: fbUser.email || '',
          name,
          avatar,
          hasOnboarded: storedOnboarded === 'true',
          hasFeatureOnboarded: false,
          crewId: isOwner || isDeveloperAdmin ? CLUB_ID : null,
          role: isOwner || isDeveloperAdmin ? 'admin' : 'member',
          pendingCrewId: isOwner || isDeveloperAdmin ? null : CLUB_ID,
          joinedAt: new Date().toISOString(),
          preferences: DEFAULT_PREFERENCES,
          lastActiveAt: new Date().toISOString(),
        });
        if (isOwner) {
          await ensureSingleClubOwner({
            id: fbUser.uid,
            email: fbUser.email || '',
            name,
            avatar,
          });
        } else if (isDeveloperAdmin) {
          await ensureDeveloperSupportAdmin({
            id: fbUser.uid,
            email: fbUser.email || '',
            name,
            avatar,
          });
        }
      } else {
        const existing = userSnap.data() as Record<string, unknown>;
        if (!existing.preferences) {
          await updateDoc(userRef, { preferences: DEFAULT_PREFERENCES });
        }
        await updateDoc(userRef, { lastActiveAt: new Date().toISOString() });
        if (isInitialOwnerEmail(fbUser.email) && !existing.crewId) {
          await ensureSingleClubOwner({
            id: fbUser.uid,
            email: String(existing.email || fbUser.email || ''),
            name: String(existing.name || fbUser.displayName || 'Admin'),
            avatar: String(existing.avatar || fbUser.photoURL || DEFAULT_AVATAR),
          });
        } else if (isDeveloperAdminEmail(fbUser.email)) {
          await ensureDeveloperSupportAdmin({
            id: fbUser.uid,
            email: String(existing.email || fbUser.email || ''),
            name: String(existing.name || fbUser.displayName || 'Developer'),
            avatar: String(existing.avatar || fbUser.photoURL || DEFAULT_AVATAR),
          });
        }
      }

      if (unsubscribeProfile) unsubscribeProfile();
      unsubscribeProfile = onSnapshot(userRef, (snap) => {
        const data = snap.data() as UserProfile | undefined;
        if (!data) {
          setProfile(null);
          setHasCrew(false);
          setIsLoading(false);
          return;
        }
        setProfile({
          id: fbUser.uid,
          email: data.email,
          name: data.name,
          avatar: data.avatar,
          emailVerified: fbUser.emailVerified,
          crewId: data.crewId || null,
          role: data.role || 'member',
          preferences: data.preferences,
          lastActiveAt: data.lastActiveAt,
          pendingCrewId: data.pendingCrewId || null,
          hasFeatureOnboarded: data.hasFeatureOnboarded === true,
        });
        setHasCrew(!!data.crewId);
        setIsLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  useEffect(() => {
    if (!isRevenueCatConfigured || isLoading || !profile?.id) return;

    const syncRevenueCatUser = async () => {
      try {
        await loginUserRef.current(profile.id);
      } catch (error) {
        if (__DEV__) {
          console.log('[AuthProvider] RevenueCat sync error:', error);
        }
      }
    };

    syncRevenueCatUser();
  }, [isLoading, isRevenueCatConfigured, profile?.id]);

  const completeOnboarding = useCallback(async () => {
    await SafeAsyncStorage.setItem(STORAGE_KEYS.HAS_ONBOARDED, 'true');
    setHasOnboarded(true);
    if (profile?.id) {
      await updateDoc(doc(db, 'users', profile.id), { hasOnboarded: true });
    }
  }, [profile?.id]);

  const completeFeatureOnboarding = useCallback(async () => {
    await SafeAsyncStorage.setItem(STORAGE_KEYS.HAS_FEATURE_ONBOARDED, 'true');
    if (profile?.id) {
      await updateDoc(doc(db, 'users', profile.id), { hasFeatureOnboarded: true }).catch((error) => {
        if (__DEV__) {
          console.log('[AuthProvider] Feature onboarding sync error:', error);
        }
      });
    }
    setProfile((current) =>
      current ? { ...current, hasFeatureOnboarded: true } : current
    );
  }, [profile?.id]);

  const signUp = useCallback(async ({ email, password, name }: { email: string; password: string; name: string }) => {
    setIsSigningUp(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateFirebaseProfile(credential.user, { displayName: name, photoURL: DEFAULT_AVATAR });

      let verificationEmailSent = false;
      try {
        await sendEmailVerification(credential.user);
        verificationEmailSent = true;
      } catch (error) {
        if (__DEV__) {
          console.log('[AuthProvider] Verification email error:', error);
        }
      }

      // onAuthStateChanged may have already created the user doc (race condition),
      // so check first — if it exists, only update the name.
      const userRef = doc(db, 'users', credential.user.uid);
      const existingSnap = await getDoc(userRef);
      if (!existingSnap.exists()) {
        const isOwner = isInitialOwnerEmail(email);
        const isDeveloperAdmin = isDeveloperAdminEmail(email);
        await setDoc(userRef, {
          id: credential.user.uid,
          email,
          name,
          avatar: DEFAULT_AVATAR,
          hasOnboarded: true,
          hasFeatureOnboarded: false,
          crewId: isOwner || isDeveloperAdmin ? CLUB_ID : null,
          role: isOwner || isDeveloperAdmin ? 'admin' : 'member',
          pendingCrewId: isOwner || isDeveloperAdmin ? null : CLUB_ID,
          joinedAt: new Date().toISOString(),
          preferences: DEFAULT_PREFERENCES,
          lastActiveAt: new Date().toISOString(),
        });
        if (isOwner) {
          await ensureSingleClubOwner({
            id: credential.user.uid,
            email,
            name,
            avatar: DEFAULT_AVATAR,
          });
        } else if (isDeveloperAdmin) {
          await ensureDeveloperSupportAdmin({
            id: credential.user.uid,
            email,
            name,
            avatar: DEFAULT_AVATAR,
          });
        }
      } else {
        await updateDoc(userRef, { name, hasOnboarded: true });
        if (isInitialOwnerEmail(email)) {
          await ensureSingleClubOwner({
            id: credential.user.uid,
            email,
            name,
            avatar: DEFAULT_AVATAR,
          });
        } else if (isDeveloperAdminEmail(email)) {
          await ensureDeveloperSupportAdmin({
            id: credential.user.uid,
            email,
            name,
            avatar: DEFAULT_AVATAR,
          });
        }
      }
      await SafeAsyncStorage.setItem(STORAGE_KEYS.HAS_ONBOARDED, 'true');
      setHasOnboarded(true);
      return { verificationEmailSent };
    } finally {
      setIsSigningUp(false);
    }
  }, []);

  const signIn = useCallback(async ({ email, password }: { email: string; password: string }) => {
    setIsSigningIn(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const joinCrew = useCallback(async (inviteCode: string) => {
    if (!profile?.id) throw new Error('Not authenticated');
    setIsJoiningCrew(true);
    try {
      const callable = httpsCallable(functions, 'joinCrewByInvite');
      await callable({ inviteCode: inviteCode.toUpperCase() });
    } finally {
      setIsJoiningCrew(false);
    }
  }, [profile?.id]);

  const requestJoin = useCallback(async (crewId: string, message?: string) => {
    if (!profile?.id) throw new Error('Not authenticated');
    const requestRef = doc(db, 'crews', crewId, 'joinRequests', profile.id);
    const existing = await getDoc(requestRef);
    if (existing.exists()) {
      const data = existing.data() as { status?: string };
      if (data.status === 'pending') return;
    }
    await setDoc(requestRef, {
      id: profile.id,
      crewId,
      userId: profile.id,
      userName: profile.name,
      userAvatar: profile.avatar,
      userEmail: profile.email,
      status: 'pending',
      message: message || '',
      createdAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, 'users', profile.id), { pendingCrewId: crewId });
  }, [profile]);

  const cancelJoinRequest = useCallback(async (crewId: string) => {
    if (!profile?.id) throw new Error('Not authenticated');
    const requestRef = doc(db, 'crews', crewId, 'joinRequests', profile.id);
    await deleteDoc(requestRef);
    await updateDoc(doc(db, 'users', profile.id), { pendingCrewId: null });
  }, [profile?.id]);

  const createCrew = useCallback(async ({
    name,
    description,
    logoUri,
    isDiscoverable = true,
    requiresApproval = true,
    subscriptionStatus = 'inactive',
  }: {
    name: string;
    description: string;
    logoUri?: string;
    isDiscoverable?: boolean;
    requiresApproval?: boolean;
    subscriptionStatus?: 'active' | 'inactive' | 'past_due' | 'trialing';
  }) => {
    if (!profile?.id) throw new Error('Not authenticated');
    setIsCreatingCrew(true);
    try {
      const crewRef = doc(db, 'crews', CLUB_ID);
      const crewId = CLUB_ID;
      const inviteCode = generateInviteCode();
      const coverImage = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=400&fit=crop';
      let logoUrl = '';

      if (logoUri && !logoUri.startsWith('http')) {
        const response = await fetch(logoUri);
        const blob = await response.blob();
        const storageRef = ref(storage, `crews/${crewId}/logo.jpg`);
        await uploadBytes(storageRef, blob);
        logoUrl = await getDownloadURL(storageRef);
      } else if (logoUri) {
        logoUrl = logoUri;
      }

      await setDoc(crewRef, {
        id: crewId,
        name: name.trim() || CLUB_NAME,
        description: description.trim() || CLUB_DESCRIPTION,
        nameLower: (name.trim() || CLUB_NAME).toLowerCase(),
        logoUrl,
        isDiscoverable,
        requiresApproval,
        coverImage,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        totalRides: 0,
        totalMiles: 0,
        totalPhotos: 0,
        ownerId: profile.id,
        subscriptionOwnerId:
          subscriptionStatus === 'active' || subscriptionStatus === 'trialing'
            ? profile.id
            : null,
        subscriptionStatus,
        status: 'active',
        archivedAt: null,
        purgeAt: null,
      });

      const memberRef = doc(db, 'crews', crewId, 'members', profile.id);
      await setDoc(memberRef, {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
        role: 'admin',
        joinedCrewAt: new Date().toISOString(),
        ridesAttended: 0,
        milesTraveled: 0,
      }, { merge: true });

      await setDoc(doc(db, 'crews', crewId, 'private', 'settings'), {
        inviteCode,
        expiresAt: null,
        updatedAt: new Date().toISOString(),
      });

      await setDoc(doc(db, 'crewInviteCodes', inviteCode), {
        code: inviteCode,
        crewId,
        expiresAt: null,
        createdBy: profile.id,
        createdAt: new Date().toISOString(),
      });

      await updateDoc(doc(db, 'users', profile.id), { crewId, role: 'admin' });

      return { id: crewId, name, description };
    } finally {
      setIsCreatingCrew(false);
    }
  }, [profile]);

  const updateUserProfile = useCallback(async (updates: { name?: string; avatar?: string }) => {
    if (!profile?.id) throw new Error('Not authenticated');
    const uid = profile.id;
    await updateDoc(doc(db, 'users', uid), updates);
    if (profile.crewId) {
      await updateDoc(doc(db, 'crews', profile.crewId, 'members', uid), updates);
    }
  }, [profile]);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    if (!profile?.id) throw new Error('Not authenticated');
    const uid = profile.id;
    const preferences = { ...DEFAULT_PREFERENCES, ...profile.preferences, ...updates };
    await updateDoc(doc(db, 'users', uid), { preferences });
  }, [profile]);

  const signOut = useCallback(async () => {
    try {
      if (isRevenueCatConfigured) {
        await logoutUser();
      }
    } catch (error) {
      if (__DEV__) {
        console.log('[AuthProvider] RevenueCat logout error:', error);
      }
    } finally {
      await firebaseSignOut(auth);
    }
  }, [isRevenueCatConfigured, logoutUser]);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const updateEmailAddress = useCallback(async ({
    currentPassword,
    newEmail,
  }: {
    currentPassword: string;
    newEmail: string;
  }) => {
    if (!profile?.id || !auth.currentUser?.email) throw new Error('Not authenticated');
    const trimmedEmail = newEmail.trim().toLowerCase();
    if (!trimmedEmail) throw new Error('EMAIL_REQUIRED');

    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updateEmail(auth.currentUser, trimmedEmail);
    await sendEmailVerification(auth.currentUser).catch((error) => {
      if (__DEV__) {
        console.log('[AuthProvider] Verification email after email update error:', error);
      }
    });

    await updateDoc(doc(db, 'users', profile.id), { email: trimmedEmail });
    if (profile.crewId) {
      await updateDoc(doc(db, 'crews', profile.crewId, 'members', profile.id), {
        email: trimmedEmail,
      });
    }
  }, [profile?.crewId, profile?.id]);

  const updateAccountPassword = useCallback(async ({
    currentPassword,
    newPassword,
  }: {
    currentPassword: string;
    newPassword: string;
  }) => {
    if (!auth.currentUser?.email) throw new Error('Not authenticated');
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    await sendEmailVerification(auth.currentUser);
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!profile?.id) throw new Error('Not authenticated');
    const callable = httpsCallable(functions, 'deleteAccountAndCleanup');
    const result = await callable();
    await SafeAsyncStorage.removeItem(STORAGE_KEYS.HAS_ONBOARDED);
    await SafeAsyncStorage.removeItem(STORAGE_KEYS.HAS_FEATURE_ONBOARDED);
    if (isRevenueCatConfigured) {
      await logoutUser().catch((error) => {
        if (__DEV__) {
          console.log('[AuthProvider] RevenueCat logout error:', error);
        }
      });
    }
    await firebaseSignOut(auth).catch(() => undefined);
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
  }, [isRevenueCatConfigured, logoutUser, profile?.id]);

  const getAuthStatus = useCallback((): AuthStatus => {
    if (isLoading || hasOnboarded === null) {
      return 'loading';
    }
    if (!hasOnboarded) {
      return 'onboarding';
    }
    if (!profile) {
      return 'unauthenticated';
    }
    if (!profile.hasFeatureOnboarded) {
      return 'feature_onboarding';
    }
    if (!hasCrew) {
      return 'needs_crew';
    }
    return 'authenticated';
  }, [isLoading, hasOnboarded, profile, hasCrew]);

  return {
    user: profile,
    authStatus: getAuthStatus(),
    isLoading,
    completeOnboarding,
    completeFeatureOnboarding,
    signUp,
    signIn,
    joinCrew,
    requestJoin,
    cancelJoinRequest,
    createCrew,
    signOut,
    resetPassword,
    updateEmailAddress,
    updateAccountPassword,
    resendVerificationEmail,
    updateProfile: updateUserProfile,
    updatePreferences,
    deleteAccount,
    isSigningUp,
    isSigningIn,
    isJoiningCrew,
    isCreatingCrew,
  };
});
