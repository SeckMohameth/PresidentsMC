"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onJoinRequestUpdated = exports.onJoinRequestCreated = exports.onCrewMemberWritten = exports.onCrewRideWritten = exports.purgeArchivedCrews = exports.revenueCatWebhook = exports.setCrewMemberLeadership = exports.setCrewMemberRole = exports.removeCrewMember = exports.denyJoinRequest = exports.approveJoinRequest = exports.deleteAccountAndCleanup = exports.leaveCrew = exports.setCrewInviteCode = exports.getCrewInviteCode = exports.joinCrewByInvite = exports.recordAnalyticsEvents = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_2 = require("firebase-admin/firestore");
const storage_1 = require("firebase-admin/storage");
const params_1 = require("firebase-functions/params");
const revenueCatWebhookSecret = (0, params_1.defineSecret)('REVENUECAT_WEBHOOK_SECRET');
(0, app_1.initializeApp)();
const adminDb = (0, firestore_2.getFirestore)();
const adminAuth = (0, auth_1.getAuth)();
const storage = (0, storage_1.getStorage)();
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const FORMER_MEMBER_NAME = 'Former Member';
const FORMER_MEMBER_AVATAR = '';
const SYSTEM_ACTOR = 'system';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const isExpoPushToken = (token) => token.startsWith('ExpoPushToken[') || token.startsWith('ExponentPushToken[');
const isActiveSubscription = (status) => status === 'active' || status === 'trialing';
const chunkArray = (items, size) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};
function normalizeIso(value, fallback = new Date(0).toISOString()) {
    if (!value)
        return fallback;
    if (typeof value === 'string')
        return value;
    if (value instanceof firestore_2.Timestamp)
        return value.toDate().toISOString();
    if (typeof value.toDate === 'function') {
        return value.toDate().toISOString();
    }
    return fallback;
}
function resolveRideStatus(ride) {
    const status = ride.status ?? 'upcoming';
    if (status !== 'upcoming')
        return status;
    const rideAt = new Date(normalizeIso(ride.dateTime)).getTime();
    if (Number.isNaN(rideAt))
        return status;
    return rideAt < Date.now() ? 'completed' : status;
}
function pickNextOwner(members, excludeId) {
    const candidates = members.filter((member) => member.id !== excludeId);
    if (candidates.length === 0)
        return null;
    const priority = (role) => {
        if (role === 'admin' || role === 'officer')
            return 0;
        return 1;
    };
    return [...candidates].sort((a, b) => {
        const roleDiff = priority(a.role) - priority(b.role);
        if (roleDiff !== 0)
            return roleDiff;
        return (new Date(normalizeIso(a.joinedCrewAt || a.joinedAt)).getTime() -
            new Date(normalizeIso(b.joinedCrewAt || b.joinedAt)).getTime());
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
function parseRevenueCatPayload(payload) {
    const event = payload?.event ?? payload ?? {};
    const appUserId = event.app_user_id ??
        event.appUserId ??
        event.original_app_user_id ??
        payload?.app_user_id ??
        null;
    const eventType = String(event.type ?? payload?.type ?? '').toUpperCase();
    const periodType = String(event.period_type ?? payload?.period_type ?? '').toLowerCase();
    const expirationAtMs = Number(event.expiration_at_ms ??
        event.expires_at_ms ??
        payload?.expiration_at_ms ??
        payload?.expires_at_ms ??
        0);
    if (eventType === 'BILLING_ISSUE') {
        return { appUserId, status: 'past_due' };
    }
    if ([
        'INITIAL_PURCHASE',
        'RENEWAL',
        'UNCANCELLATION',
        'NON_RENEWING_PURCHASE',
        'PRODUCT_CHANGE',
        'TRANSFER',
        'TEMPORARY_ENTITLEMENT_GRANT',
    ].includes(eventType)) {
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
async function sendExpoPush(messages) {
    const valid = messages.filter((msg) => isExpoPushToken(msg.to));
    if (valid.length === 0)
        return;
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
async function getUserPreferences(userId) {
    const snap = await adminDb.collection('users').doc(userId).get();
    return snap.exists ? (snap.data().preferences ?? {}) : {};
}
async function getUserPushTokens(userId) {
    const snap = await adminDb.collection('users').doc(userId).collection('pushTokens').get();
    return snap.docs.map((docSnap) => docSnap.id);
}
async function flushBatch(batch, operations) {
    if (operations === 0)
        return 0;
    await batch.commit();
    return 0;
}
async function deleteUserPushTokens(userId) {
    const tokensSnap = await adminDb.collection('users').doc(userId).collection('pushTokens').get();
    if (tokensSnap.empty)
        return;
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
async function anonymizeUserGeneratedContent(userId) {
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
    const queueUpdate = async (ref, data) => {
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
        const ride = docSnap.data();
        const photos = Array.isArray(ride.photos) ? ride.photos : [];
        const nextPhotos = photos.map((photo) => photo?.uploadedBy === userId
            ? {
                ...photo,
                uploadedBy: null,
                uploadedByName: FORMER_MEMBER_NAME,
            }
            : photo);
        const rideUpdate = {};
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
async function deleteUserStorage(userId) {
    try {
        await storage.bucket().deleteFiles({ prefix: `users/${userId}/` });
    }
    catch (error) {
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
    throw new https_1.HttpsError('internal', 'INVITE_CODE_GENERATION_FAILED');
}
async function persistCrewInviteCode(crewRef, inviteCode) {
    const normalizedCode = inviteCode.toUpperCase();
    const now = new Date().toISOString();
    await Promise.all([
        crewRef.collection('private').doc('settings').set({
            inviteCode: normalizedCode,
            updatedAt: now,
        }, { merge: true }),
        adminDb.collection('crewInviteCodes').doc(normalizedCode).set({
            code: normalizedCode,
            crewId: crewRef.id,
            updatedAt: now,
        }, { merge: true }),
        crewRef.set({
            inviteCode: firestore_2.FieldValue.delete(),
        }, { merge: true }),
    ]);
    return normalizedCode;
}
async function getOrCreateCrewInviteCode(crewRef, crew) {
    const privateSettingsSnap = await crewRef.collection('private').doc('settings').get();
    const privateInviteCode = String(privateSettingsSnap.data()?.inviteCode ?? '').trim().toUpperCase();
    if (privateInviteCode) {
        return privateInviteCode;
    }
    const crewData = crew ?? (await crewRef.get()).data();
    const legacyInviteCode = String(crewData?.inviteCode ?? '').trim().toUpperCase();
    const inviteCode = legacyInviteCode || (await generateUniqueInviteCode());
    return persistCrewInviteCode(crewRef, inviteCode);
}
async function refreshCrewAggregates(crewId) {
    const crewRef = adminDb.collection('crews').doc(crewId);
    const [crewSnap, membersSnap, ridesSnap] = await Promise.all([
        crewRef.get(),
        crewRef.collection('members').get(),
        crewRef.collection('rides').get(),
    ]);
    if (!crewSnap.exists)
        return;
    const rides = ridesSnap.docs.map((docSnap) => docSnap.data());
    const members = membersSnap.docs.map((docSnap) => docSnap.data());
    const totalRides = rides.length;
    const totalMiles = rides.reduce((sum, ride) => sum + Number(ride.estimatedDistance ?? 0), 0);
    const totalPhotos = rides.reduce((sum, ride) => sum + (Array.isArray(ride.photos) ? ride.photos.length : 0), 0);
    const memberCount = members.length;
    await crewRef.set({
        memberCount,
        totalRides,
        totalMiles: Math.round(totalMiles * 10) / 10,
        totalPhotos,
    }, { merge: true });
    const completedRides = rides.filter((ride) => resolveRideStatus(ride) === 'completed');
    const now = new Date();
    const startOfDay = (date) => {
        const value = new Date(date);
        value.setHours(0, 0, 0, 0);
        return value;
    };
    const getWeekStart = (date) => {
        const value = startOfDay(date);
        const diff = (value.getDay() + 6) % 7;
        value.setDate(value.getDate() - diff);
        return value;
    };
    const getWeekEnd = (date) => {
        const value = getWeekStart(date);
        value.setDate(value.getDate() + 6);
        value.setHours(23, 59, 59, 999);
        return value;
    };
    const periods = [
        {
            period: 'week',
            start: getWeekStart(now),
            end: getWeekEnd(now),
        },
        {
            period: 'month',
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
        },
        {
            period: 'year',
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
        await crewRef.collection('statsHistory').doc(snapshotId).set({
            id: snapshotId,
            crewId,
            period: period.period,
            periodStart: period.start.toISOString(),
            periodEnd: period.end.toISOString(),
            totalRides: ridesInPeriod.length,
            totalMiles: Math.round(ridesInPeriod.reduce((sum, ride) => sum + Number(ride.estimatedDistance ?? 0), 0) * 10) / 10,
            totalPhotos: ridesInPeriod.reduce((sum, ride) => {
                const photos = Array.isArray(ride.photos) ? ride.photos : [];
                return sum + photos.length;
            }, 0),
            totalMembers: memberCount,
            createdAt: new Date().toISOString(),
        }, { merge: true });
    }
}
async function getActingMemberContext(userId) {
    const userRef = adminDb.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('not-found', 'USER_NOT_FOUND');
    }
    const user = userSnap.data();
    if (!user.crewId) {
        throw new https_1.HttpsError('failed-precondition', 'NO_CREW');
    }
    const crewRef = adminDb.collection('crews').doc(user.crewId);
    const memberRef = crewRef.collection('members').doc(userId);
    const [crewSnap, memberSnap] = await Promise.all([crewRef.get(), memberRef.get()]);
    if (!crewSnap.exists || !memberSnap.exists) {
        throw new https_1.HttpsError('failed-precondition', 'NO_CREW');
    }
    return {
        user,
        userRef,
        crewRef,
        crew: crewSnap.data(),
        memberRef,
        member: memberSnap.data(),
    };
}
function requireLeadership(member) {
    const role = member.role;
    if (role !== 'admin' && role !== 'officer') {
        throw new https_1.HttpsError('permission-denied', 'NOT_AUTHORIZED');
    }
}
function requireActiveLeadership(member, crew) {
    requireLeadership(member);
    if (!isActiveSubscription(crew.subscriptionStatus)) {
        throw new https_1.HttpsError('failed-precondition', 'SUBSCRIPTION_INACTIVE');
    }
}
function requireAdmin(member) {
    if (member.role !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'NOT_AUTHORIZED');
    }
}
function countAdmins(members) {
    return members.filter((member) => member.role === 'admin').length;
}
async function exitCrew(userId, deleteAccount) {
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
            };
        }
        const user = userSnap.data();
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
            };
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
            };
        }
        const crew = crewSnap.data();
        const members = membersSnap.docs.map((docSnap) => docSnap.data());
        const isOwner = crew.ownerId === userId;
        const remainingMembers = members.filter((member) => member.id !== userId);
        const nextOwner = isOwner && remainingMembers.length > 0
            ? pickNextOwner(members, userId) ?? remainingMembers[0]
            : null;
        const now = new Date();
        const archiveFields = buildArchiveFields(now);
        if (remainingMembers.length === 0) {
            transaction.set(crewRef, {
                ownerId: null,
                subscriptionOwnerId: null,
                subscriptionStatus: 'inactive',
                status: 'archived',
                archivedAt: archiveFields.archivedAt,
                purgeAt: archiveFields.purgeAt,
                memberCount: 0,
            }, { merge: true });
        }
        else if (isOwner && nextOwner) {
            transaction.set(crewRef, {
                ownerId: nextOwner.id,
                subscriptionOwnerId: null,
                subscriptionStatus: 'inactive',
                status: 'active',
                archivedAt: null,
                purgeAt: null,
                memberCount: remainingMembers.length,
            }, { merge: true });
            transaction.set(crewRef.collection('members').doc(nextOwner.id), { role: 'admin' }, { merge: true });
            transaction.set(adminDb.collection('users').doc(nextOwner.id), { role: 'admin' }, { merge: true });
        }
        else {
            transaction.set(crewRef, {
                memberCount: remainingMembers.length,
            }, { merge: true });
        }
        transaction.delete(memberRef);
        transaction.set(userRef, { crewId: null, role: 'member' }, { merge: true });
        return {
            crewId: crewRef.id,
            crewName: crew.name ?? null,
            ownershipTransferred: Boolean(isOwner && nextOwner),
            crewArchived: remainingMembers.length === 0,
            leftAsOwner: isOwner,
            shouldManageSubscription: Boolean(isOwner) || Boolean(crew.subscriptionOwnerId && crew.subscriptionOwnerId === userId),
            nextOwnerId: nextOwner?.id ?? null,
            nextOwnerName: nextOwner?.name ?? null,
        };
    });
    return result;
}
function normalizeAnalyticsEvent(input, fallbackUserId) {
    const eventName = String(input.eventName ?? '').trim();
    if (!eventName) {
        throw new https_1.HttpsError('invalid-argument', 'EVENT_NAME_REQUIRED');
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
exports.recordAnalyticsEvents = (0, https_1.onCall)(async (request) => {
    const rawEvents = Array.isArray(request.data?.events)
        ? request.data.events
        : request.data?.event
            ? [request.data.event]
            : [];
    if (rawEvents.length === 0) {
        throw new https_1.HttpsError('invalid-argument', 'EVENTS_REQUIRED');
    }
    const events = rawEvents.slice(0, 25).map((event) => normalizeAnalyticsEvent(event, request.auth?.uid ?? null));
    const batch = adminDb.batch();
    const dailyCounts = new Map();
    for (const event of events) {
        const eventRef = adminDb.collection('analyticsEvents').doc(event.id);
        batch.set(eventRef, {
            ...event,
            createdAt: firestore_2.FieldValue.serverTimestamp(),
        });
        const dayKey = event.clientTimestamp.slice(0, 10) || new Date().toISOString().slice(0, 10);
        const current = dailyCounts.get(dayKey) ?? {
            totalEvents: 0,
            eventCounts: {},
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
        batch.set(adminDb.collection('analyticsDaily').doc(dayKey), {
            id: dayKey,
            date: dayKey,
            totalEvents: firestore_2.FieldValue.increment(summary.totalEvents),
            appVersion: summary.appVersion,
            eventCounts: Object.entries(summary.eventCounts).reduce((acc, [eventName, count]) => {
                acc[eventName] = firestore_2.FieldValue.increment(count);
                return acc;
            }, {}),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    await batch.commit();
    return { recorded: events.length };
});
exports.joinCrewByInvite = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'AUTH_REQUIRED');
    }
    const inviteCode = String(request.data?.inviteCode ?? '')
        .trim()
        .toUpperCase();
    if (!inviteCode) {
        throw new https_1.HttpsError('invalid-argument', 'INVALID_INVITE_CODE');
    }
    const userRef = adminDb.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
        throw new https_1.HttpsError('not-found', 'USER_NOT_FOUND');
    }
    const user = userSnap.data();
    const inviteLookupSnap = await adminDb.collection('crewInviteCodes').doc(inviteCode).get();
    let crewDoc = null;
    if (inviteLookupSnap.exists) {
        const lookupData = inviteLookupSnap.data();
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
            throw new https_1.HttpsError('not-found', 'INVALID_INVITE_CODE');
        }
        crewDoc = legacyCrewSnap.docs[0];
        await persistCrewInviteCode(crewDoc.ref, inviteCode);
    }
    const crew = crewDoc.data();
    if (crew.status === 'archived') {
        throw new https_1.HttpsError('failed-precondition', 'CREW_ARCHIVED');
    }
    if (user.crewId && user.crewId !== crewDoc.id) {
        throw new https_1.HttpsError('failed-precondition', 'ALREADY_IN_CREW');
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
                throw new https_1.HttpsError('not-found', 'JOIN_TARGET_NOT_FOUND');
            }
            const freshUser = freshUserSnap.data();
            if (freshUser.crewId && freshUser.crewId !== crewDoc.id) {
                throw new https_1.HttpsError('failed-precondition', 'ALREADY_IN_CREW');
            }
            if (!freshMemberSnap.exists) {
                transaction.set(memberRef, {
                    id: userId,
                    email: freshUser.email ?? '',
                    name: freshUser.name ?? 'Member',
                    avatar: freshUser.avatar ?? '',
                    role: 'member',
                    joinedCrewAt: new Date().toISOString(),
                    ridesAttended: 0,
                    milesTraveled: 0,
                }, { merge: true });
                transaction.set(crewDoc.ref, {
                    memberCount: firestore_2.FieldValue.increment(1),
                    status: 'active',
                    archivedAt: null,
                    purgeAt: null,
                }, { merge: true });
            }
            transaction.set(userRef, { crewId: crewDoc.id, role: 'member' }, { merge: true });
            transaction.set(joinRequestRef, {
                status: 'approved',
                decidedAt: new Date().toISOString(),
                decidedBy: SYSTEM_ACTOR,
            }, { merge: true });
        });
    }
    return {
        crewId: crewDoc.id,
        crewName: crew.name ?? null,
    };
});
exports.getCrewInviteCode = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'AUTH_REQUIRED');
    }
    const context = await getActingMemberContext(userId);
    requireLeadership(context.member);
    const inviteCode = await getOrCreateCrewInviteCode(context.crewRef, context.crew);
    const privateSettingsSnap = await context.crewRef.collection('private').doc('settings').get();
    return {
        inviteCode,
        expiresAt: privateSettingsSnap.data()?.expiresAt ?? null,
    };
});
exports.setCrewInviteCode = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'AUTH_REQUIRED');
    }
    const context = await getActingMemberContext(userId);
    requireLeadership(context.member);
    const currentCode = await getOrCreateCrewInviteCode(context.crewRef, context.crew);
    const nextCode = String(request.data?.inviteCode ?? currentCode)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    const expiresAtRaw = request.data?.expiresAt;
    const expiresAt = typeof expiresAtRaw === 'string' && expiresAtRaw.trim() ? expiresAtRaw : null;
    if (nextCode.length < 4 || nextCode.length > 16) {
        throw new https_1.HttpsError('invalid-argument', 'INVITE_CODE_LENGTH');
    }
    await adminDb.runTransaction(async (transaction) => {
        const lookupRef = adminDb.collection('crewInviteCodes').doc(nextCode);
        const lookupSnap = await transaction.get(lookupRef);
        if (lookupSnap.exists) {
            const data = lookupSnap.data();
            if (data.crewId && data.crewId !== context.crewRef.id) {
                throw new https_1.HttpsError('failed-precondition', 'INVITE_CODE_TAKEN');
            }
        }
        const now = new Date().toISOString();
        transaction.set(context.crewRef.collection('private').doc('settings'), {
            inviteCode: nextCode,
            expiresAt,
            updatedAt: now,
        }, { merge: true });
        transaction.set(lookupRef, {
            code: nextCode,
            crewId: context.crewRef.id,
            expiresAt,
            createdBy: userId,
            updatedAt: now,
        }, { merge: true });
        if (nextCode !== currentCode) {
            transaction.delete(adminDb.collection('crewInviteCodes').doc(currentCode));
        }
    });
    return { inviteCode: nextCode, expiresAt };
});
exports.leaveCrew = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'AUTH_REQUIRED');
    }
    const result = await exitCrew(userId, false);
    return result;
});
exports.deleteAccountAndCleanup = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'AUTH_REQUIRED');
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
    }
    catch (error) {
        const code = String(error?.code ?? '');
        if (code !== 'auth/user-not-found') {
            console.log('[Functions] deleteUser error:', error);
            throw new https_1.HttpsError('internal', 'ACCOUNT_DELETE_FAILED');
        }
    }
    await userRef.delete().catch((error) => {
        console.log('[Functions] delete user profile error:', error);
        throw new https_1.HttpsError('internal', 'ACCOUNT_PROFILE_DELETE_FAILED');
    });
    return result;
});
exports.approveJoinRequest = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'AUTH_REQUIRED');
    }
    const requestId = String(request.data?.requestId ?? '').trim();
    if (!requestId) {
        throw new https_1.HttpsError('invalid-argument', 'REQUEST_ID_REQUIRED');
    }
    const context = await getActingMemberContext(userId);
    requireLeadership(context.member);
    const joinRequestRef = context.crewRef.collection('joinRequests').doc(requestId);
    const joinRequestSnap = await joinRequestRef.get();
    if (!joinRequestSnap.exists) {
        throw new https_1.HttpsError('not-found', 'JOIN_REQUEST_NOT_FOUND');
    }
    const joinRequest = joinRequestSnap.data();
    const targetUserRef = adminDb.collection('users').doc(joinRequest.userId);
    const targetMemberRef = context.crewRef.collection('members').doc(joinRequest.userId);
    await adminDb.runTransaction(async (transaction) => {
        const [targetUserSnap, targetMemberSnap, freshRequestSnap] = await Promise.all([
            transaction.get(targetUserRef),
            transaction.get(targetMemberRef),
            transaction.get(joinRequestRef),
        ]);
        if (!freshRequestSnap.exists) {
            throw new https_1.HttpsError('not-found', 'JOIN_REQUEST_NOT_FOUND');
        }
        const freshRequest = freshRequestSnap.data();
        if (freshRequest.status === 'approved')
            return;
        if (!targetUserSnap.exists) {
            throw new https_1.HttpsError('not-found', 'USER_NOT_FOUND');
        }
        const targetUser = targetUserSnap.data();
        if (targetUser.crewId && targetUser.crewId !== context.crewRef.id) {
            throw new https_1.HttpsError('failed-precondition', 'USER_ALREADY_IN_CREW');
        }
        if (!targetMemberSnap.exists) {
            transaction.set(targetMemberRef, {
                id: joinRequest.userId,
                email: targetUser.email ?? joinRequest.userEmail ?? '',
                name: targetUser.name ?? joinRequest.userName ?? 'Member',
                avatar: targetUser.avatar ?? joinRequest.userAvatar ?? '',
                role: 'member',
                joinedCrewAt: new Date().toISOString(),
                ridesAttended: 0,
                milesTraveled: 0,
            }, { merge: true });
            transaction.set(context.crewRef, { memberCount: firestore_2.FieldValue.increment(1) }, { merge: true });
        }
        transaction.set(targetUserRef, { crewId: context.crewRef.id, role: 'member' }, { merge: true });
        transaction.set(joinRequestRef, {
            status: 'approved',
            decidedAt: new Date().toISOString(),
            decidedBy: userId,
        }, { merge: true });
    });
    return { ok: true };
});
exports.denyJoinRequest = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'AUTH_REQUIRED');
    }
    const requestId = String(request.data?.requestId ?? '').trim();
    if (!requestId) {
        throw new https_1.HttpsError('invalid-argument', 'REQUEST_ID_REQUIRED');
    }
    const context = await getActingMemberContext(userId);
    requireLeadership(context.member);
    await context.crewRef.collection('joinRequests').doc(requestId).set({
        status: 'denied',
        decidedAt: new Date().toISOString(),
        decidedBy: userId,
    }, { merge: true });
    return { ok: true };
});
exports.removeCrewMember = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'AUTH_REQUIRED');
    }
    const memberId = String(request.data?.memberId ?? '').trim();
    if (!memberId) {
        throw new https_1.HttpsError('invalid-argument', 'MEMBER_ID_REQUIRED');
    }
    const context = await getActingMemberContext(userId);
    requireAdmin(context.member);
    if (context.crew.ownerId === memberId) {
        throw new https_1.HttpsError('failed-precondition', 'OWNER_REMOVE_NOT_ALLOWED');
    }
    const targetMemberRef = context.crewRef.collection('members').doc(memberId);
    const targetUserRef = adminDb.collection('users').doc(memberId);
    const targetMemberSnap = await targetMemberRef.get();
    if (!targetMemberSnap.exists) {
        throw new https_1.HttpsError('not-found', 'MEMBER_NOT_FOUND');
    }
    await adminDb.runTransaction(async (transaction) => {
        const [freshTargetMemberSnap, targetUserSnap, membersSnap] = await Promise.all([
            transaction.get(targetMemberRef),
            transaction.get(targetUserRef),
            transaction.get(context.crewRef.collection('members')),
        ]);
        if (!freshTargetMemberSnap.exists) {
            return;
        }
        const targetMember = freshTargetMemberSnap.data();
        const admins = countAdmins(membersSnap.docs.map((docSnap) => docSnap.data()));
        if (targetMember.role === 'admin' && admins <= 1) {
            throw new https_1.HttpsError('failed-precondition', 'ANOTHER_ADMIN_REQUIRED');
        }
        transaction.delete(targetMemberRef);
        transaction.set(context.crewRef, {
            memberCount: firestore_2.FieldValue.increment(-1),
            ...(context.crew.subscriptionOwnerId === memberId
                ? { subscriptionOwnerId: null, subscriptionStatus: 'inactive' }
                : {}),
        }, { merge: true });
        if (targetUserSnap.exists) {
            transaction.set(targetUserRef, { crewId: null, role: 'member' }, { merge: true });
        }
    });
    return { ok: true };
});
exports.setCrewMemberRole = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'AUTH_REQUIRED');
    }
    const memberId = String(request.data?.memberId ?? '').trim();
    const role = String(request.data?.role ?? '').trim();
    if (!memberId || !['admin', 'officer', 'member'].includes(role)) {
        throw new https_1.HttpsError('invalid-argument', 'INVALID_MEMBER_ROLE');
    }
    const context = await getActingMemberContext(userId);
    requireAdmin(context.member);
    if (context.crew.ownerId === memberId && role !== 'admin') {
        throw new https_1.HttpsError('failed-precondition', 'OWNER_ROLE_LOCKED');
    }
    const targetMemberRef = context.crewRef.collection('members').doc(memberId);
    const targetUserRef = adminDb.collection('users').doc(memberId);
    const targetMemberSnap = await targetMemberRef.get();
    if (!targetMemberSnap.exists) {
        throw new https_1.HttpsError('not-found', 'MEMBER_NOT_FOUND');
    }
    await adminDb.runTransaction(async (transaction) => {
        const [freshTargetMemberSnap, membersSnap] = await Promise.all([
            transaction.get(targetMemberRef),
            transaction.get(context.crewRef.collection('members')),
        ]);
        if (!freshTargetMemberSnap.exists) {
            throw new https_1.HttpsError('not-found', 'MEMBER_NOT_FOUND');
        }
        const targetMember = freshTargetMemberSnap.data();
        if (targetMember.role === 'admin' && role !== 'admin') {
            const admins = countAdmins(membersSnap.docs.map((docSnap) => docSnap.data()));
            if (admins <= 1) {
                throw new https_1.HttpsError('failed-precondition', 'ANOTHER_ADMIN_REQUIRED');
            }
        }
        transaction.set(targetMemberRef, { role }, { merge: true });
        transaction.set(targetUserRef, { role }, { merge: true });
    });
    return { ok: true };
});
exports.setCrewMemberLeadership = (0, https_1.onCall)(async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
        throw new https_1.HttpsError('unauthenticated', 'AUTH_REQUIRED');
    }
    const memberId = String(request.data?.memberId ?? '').trim();
    const roleValue = request.data?.role ? String(request.data.role).trim() : undefined;
    const role = roleValue;
    const leadershipTitle = String(request.data?.leadershipTitle ?? '').trim().slice(0, 48);
    const rawPermissions = request.data?.permissions ?? {};
    if (!memberId || (roleValue && !['admin', 'officer', 'member'].includes(roleValue))) {
        throw new https_1.HttpsError('invalid-argument', 'INVALID_MEMBER_LEADERSHIP');
    }
    const context = await getActingMemberContext(userId);
    requireAdmin(context.member);
    if (context.crew.ownerId === memberId && role && role !== 'admin') {
        throw new https_1.HttpsError('failed-precondition', 'OWNER_ROLE_LOCKED');
    }
    const targetMemberRef = context.crewRef.collection('members').doc(memberId);
    const targetUserRef = adminDb.collection('users').doc(memberId);
    await adminDb.runTransaction(async (transaction) => {
        const [freshTargetMemberSnap, membersSnap] = await Promise.all([
            transaction.get(targetMemberRef),
            transaction.get(context.crewRef.collection('members')),
        ]);
        if (!freshTargetMemberSnap.exists) {
            throw new https_1.HttpsError('not-found', 'MEMBER_NOT_FOUND');
        }
        const targetMember = freshTargetMemberSnap.data();
        if (targetMember.role === 'admin' && role && role !== 'admin') {
            const admins = countAdmins(membersSnap.docs.map((docSnap) => docSnap.data()));
            if (admins <= 1) {
                throw new https_1.HttpsError('failed-precondition', 'ANOTHER_ADMIN_REQUIRED');
            }
        }
        const permissions = {
            manageRides: rawPermissions.manageRides === true,
            manageAnnouncements: rawPermissions.manageAnnouncements === true,
            manageAlbums: rawPermissions.manageAlbums === true,
            manageJoinRequests: rawPermissions.manageJoinRequests === true,
        };
        const memberUpdates = {
            leadershipTitle,
            permissions,
        };
        if (role) {
            memberUpdates.role = role;
        }
        transaction.set(targetMemberRef, memberUpdates, { merge: true });
        if (role) {
            transaction.set(targetUserRef, { role }, { merge: true });
        }
    });
    return { ok: true };
});
exports.revenueCatWebhook = (0, https_1.onRequest)({ secrets: [revenueCatWebhookSecret] }, async (request, response) => {
    const authHeader = String(request.headers.authorization ?? '');
    const signatureHeader = String(request.headers['x-revenuecat-signature'] ?? '');
    const expectedSecret = revenueCatWebhookSecret.value();
    const authorized = authHeader === `Bearer ${expectedSecret}` ||
        authHeader === expectedSecret ||
        signatureHeader === expectedSecret;
    if (!authorized) {
        response.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const payload = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body ?? {};
    const parsed = parseRevenueCatPayload(payload);
    if (!parsed.appUserId) {
        response.status(400).json({ error: 'Missing app user id' });
        return;
    }
    const userSnap = await adminDb.collection('users').doc(parsed.appUserId).get();
    const currentCrewId = userSnap.exists ? (userSnap.data().crewId ?? null) : null;
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
    const memberSnap = await crewRef.collection('members').doc(parsed.appUserId).get();
    const member = memberSnap.exists ? memberSnap.data() : null;
    const canOwnSubscription = memberSnap.exists &&
        member?.isDeveloperSupport !== true &&
        (member?.role === 'admin' || member?.role === 'officer');
    if (!canOwnSubscription) {
        if (member?.isDeveloperSupport === true) {
            const crewSnap = await crewRef.get();
            const crew = crewSnap.exists ? crewSnap.data() : null;
            if (crew?.subscriptionOwnerId === parsed.appUserId) {
                await crewRef.set({
                    subscriptionStatus: 'inactive',
                    subscriptionOwnerId: null,
                }, { merge: true });
            }
        }
        response.status(200).json({ ok: true, ignored: true });
        return;
    }
    await crewRef.set({
        subscriptionStatus: parsed.status,
        subscriptionOwnerId: parsed.status === 'inactive' ? null : parsed.appUserId,
    }, { merge: true });
    response.status(200).json({ ok: true });
});
exports.purgeArchivedCrews = (0, scheduler_1.onSchedule)('every day 03:00', async () => {
    const archivedCrewsSnap = await adminDb
        .collection('crews')
        .where('status', '==', 'archived')
        .get();
    const now = Date.now();
    for (const crewDoc of archivedCrewsSnap.docs) {
        const crew = crewDoc.data();
        const purgeAt = crew.purgeAt ? new Date(crew.purgeAt).getTime() : Number.POSITIVE_INFINITY;
        if (purgeAt > now)
            continue;
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
        }
        catch (error) {
            const message = String(error?.message ?? '');
            if (!message.includes('No such object') && !message.includes('Not Found')) {
                console.log('[Functions] Crew storage cleanup error:', error);
            }
        }
        await adminDb.recursiveDelete(crewDoc.ref);
    }
});
exports.onCrewRideWritten = (0, firestore_1.onDocumentWritten)('crews/{crewId}/rides/{rideId}', async (event) => {
    const crewId = event.params.crewId;
    await refreshCrewAggregates(crewId);
});
exports.onCrewMemberWritten = (0, firestore_1.onDocumentWritten)('crews/{crewId}/members/{memberId}', async (event) => {
    const crewId = event.params.crewId;
    await refreshCrewAggregates(crewId);
});
exports.onJoinRequestCreated = (0, firestore_1.onDocumentCreated)('crews/{crewId}/joinRequests/{requestId}', async (event) => {
    const crewId = event.params.crewId;
    const data = event.data?.data();
    if (!data)
        return;
    const crewSnap = await adminDb.collection('crews').doc(crewId).get();
    const crewName = crewSnap.exists ? (crewSnap.data().name ?? 'your crew') : 'your crew';
    const membersSnap = await adminDb
        .collection('crews')
        .doc(crewId)
        .collection('members')
        .where('role', 'in', ['admin', 'officer'])
        .get();
    const messages = [];
    for (const memberDoc of membersSnap.docs) {
        const memberId = memberDoc.id;
        const prefs = await getUserPreferences(memberId);
        if (prefs.pushEnabled === false || prefs.joinRequests === false)
            continue;
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
});
exports.onJoinRequestUpdated = (0, firestore_1.onDocumentUpdated)('crews/{crewId}/joinRequests/{requestId}', async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    if (before.status === after.status)
        return;
    if (!['approved', 'denied'].includes(after.status ?? ''))
        return;
    const crewId = event.params.crewId;
    const crewSnap = await adminDb.collection('crews').doc(crewId).get();
    const crewName = crewSnap.exists ? (crewSnap.data().name ?? 'your crew') : 'your crew';
    const prefs = await getUserPreferences(after.userId);
    if (prefs.pushEnabled === false || prefs.joinRequests === false)
        return;
    const tokens = await getUserPushTokens(after.userId);
    const messages = tokens.map((token) => ({
        to: token,
        title: 'Join Request Update',
        body: after.status === 'approved'
            ? `You were approved to join ${crewName}.`
            : `Your request to join ${crewName} was denied.`,
        data: { crewId, requestId: event.params.requestId },
    }));
    await sendExpoPush(messages);
});
//# sourceMappingURL=index.js.map