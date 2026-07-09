import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadString } from 'firebase/storage';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectId = 'demo-crew-beta';
const now = new Date().toISOString();

let testEnv;

async function seedData() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const storage = context.storage();

    await Promise.all([
      setDoc(doc(db, 'users', 'alice'), {
        id: 'alice',
        email: 'alice@example.com',
        name: 'Alice',
        avatar: '',
        role: 'admin',
        crewId: 'crewA',
        preferences: { pushEnabled: true },
        hasOnboarded: true,
        lastActiveAt: now,
      }),
      setDoc(doc(db, 'users', 'bob'), {
        id: 'bob',
        email: 'bob@example.com',
        name: 'Bob',
        avatar: '',
        role: 'officer',
        crewId: 'crewA',
        preferences: { pushEnabled: true },
        hasOnboarded: true,
        lastActiveAt: now,
      }),
      setDoc(doc(db, 'users', 'cara'), {
        id: 'cara',
        email: 'cara@example.com',
        name: 'Cara',
        avatar: '',
        role: 'member',
        crewId: 'crewA',
        preferences: { pushEnabled: true },
        hasOnboarded: true,
        lastActiveAt: now,
      }),
      setDoc(doc(db, 'users', 'dylan'), {
        id: 'dylan',
        email: 'dylan@example.com',
        name: 'Dylan',
        avatar: '',
        role: 'member',
        crewId: null,
        preferences: { pushEnabled: true },
        hasOnboarded: true,
        lastActiveAt: now,
      }),
      setDoc(doc(db, 'users', 'dev'), {
        id: 'dev',
        email: 'dev@example.com',
        name: 'Developer Support',
        avatar: '',
        role: 'admin',
        crewId: 'crewDev',
        preferences: { pushEnabled: true },
        hasOnboarded: true,
        lastActiveAt: now,
      }),
      setDoc(doc(db, 'users', 'mirrorAdmin'), {
        id: 'mirrorAdmin',
        email: 'mirror-admin@example.com',
        name: 'Mirror Admin',
        avatar: '',
        role: 'admin',
        crewId: 'crewA',
        preferences: { pushEnabled: true },
        hasOnboarded: true,
        lastActiveAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewA'), {
        id: 'crewA',
        name: 'Alpha Crew',
        description: 'Discoverable active crew',
        nameLower: 'alpha crew',
        ownerId: 'alice',
        subscriptionOwnerId: 'alice',
        subscriptionStatus: 'active',
        status: 'active',
        isDiscoverable: true,
        requiresApproval: true,
        memberCount: 3,
        totalRides: 1,
        totalMiles: 42,
        totalPhotos: 0,
        archivedAt: null,
        purgeAt: null,
        createdAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewPrivate'), {
        id: 'crewPrivate',
        name: 'Private Crew',
        description: 'Hidden crew',
        nameLower: 'private crew',
        ownerId: 'alice',
        subscriptionOwnerId: 'alice',
        subscriptionStatus: 'active',
        status: 'active',
        isDiscoverable: false,
        requiresApproval: true,
        memberCount: 1,
        totalRides: 0,
        totalMiles: 0,
        totalPhotos: 0,
        archivedAt: null,
        purgeAt: null,
        createdAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewDev'), {
        id: 'crewDev',
        name: 'Developer Crew',
        description: 'Inactive crew for support testing',
        nameLower: 'developer crew',
        ownerId: 'dev',
        subscriptionOwnerId: null,
        subscriptionStatus: 'inactive',
        status: 'active',
        isDiscoverable: false,
        requiresApproval: true,
        memberCount: 1,
        totalRides: 0,
        totalMiles: 0,
        totalPhotos: 0,
        archivedAt: null,
        purgeAt: null,
        createdAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewStaleSubscription'), {
        id: 'crewStaleSubscription',
        name: 'Stale Subscription Crew',
        description: 'Active subscription with a stale owner member reference',
        nameLower: 'stale subscription crew',
        ownerId: null,
        subscriptionOwnerId: 'formerPayer',
        subscriptionStatus: 'active',
        billingRequired: true,
        status: 'active',
        isDiscoverable: false,
        requiresApproval: true,
        memberCount: 1,
        totalRides: 0,
        totalMiles: 0,
        totalPhotos: 0,
        archivedAt: null,
        purgeAt: null,
        createdAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewUnpaid'), {
        id: 'crewUnpaid',
        name: 'Unpaid Crew',
        description: 'Billing required but subscription inactive',
        nameLower: 'unpaid crew',
        ownerId: 'alice',
        subscriptionOwnerId: null,
        subscriptionStatus: 'inactive',
        billingRequired: true,
        status: 'active',
        isDiscoverable: false,
        requiresApproval: true,
        memberCount: 2,
        totalRides: 1,
        totalMiles: 0,
        totalPhotos: 0,
        archivedAt: null,
        purgeAt: null,
        createdAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewUnpaid', 'members', 'alice'), {
        id: 'alice',
        email: 'alice@example.com',
        name: 'Alice',
        avatar: '',
        role: 'admin',
        joinedCrewAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewUnpaid', 'members', 'cara'), {
        id: 'cara',
        email: 'cara@example.com',
        name: 'Cara',
        avatar: '',
        role: 'member',
        joinedCrewAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewUnpaid', 'rides', 'rideU'), {
        id: 'rideU',
        crewId: 'crewUnpaid',
        title: 'Unpaid Crew Ride',
        description: 'Ride on a crew without an active subscription',
        dateTime: now,
        estimatedDuration: '2h',
        estimatedDistance: 20,
        pace: 'moderate',
        notes: '',
        coverImage: '',
        createdBy: 'alice',
        createdByName: 'Alice',
        attendees: [],
        checkedIn: [],
        status: 'upcoming',
        photos: [],
      }),
      setDoc(doc(db, 'crews', 'crewA', 'members', 'alice'), {
        id: 'alice',
        email: 'alice@example.com',
        name: 'Alice',
        avatar: '',
        role: 'admin',
        joinedCrewAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewA', 'members', 'bob'), {
        id: 'bob',
        email: 'bob@example.com',
        name: 'Bob',
        avatar: '',
        role: 'officer',
        joinedCrewAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewA', 'members', 'cara'), {
        id: 'cara',
        email: 'cara@example.com',
        name: 'Cara',
        avatar: '',
        role: 'member',
        joinedCrewAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewA', 'members', 'mirrorAdmin'), {
        id: 'mirrorAdmin',
        email: 'mirror-admin@example.com',
        name: 'Mirror Admin',
        avatar: '',
        role: 'member',
        joinedCrewAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewPrivate', 'members', 'alice'), {
        id: 'alice',
        email: 'alice@example.com',
        name: 'Alice',
        avatar: '',
        role: 'admin',
        joinedCrewAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewDev', 'members', 'dev'), {
        id: 'dev',
        email: 'dev@example.com',
        name: 'Developer Support',
        avatar: '',
        role: 'admin',
        isDeveloperSupport: true,
        joinedCrewAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewStaleSubscription', 'members', 'alice'), {
        id: 'alice',
        email: 'alice@example.com',
        name: 'Alice',
        avatar: '',
        role: 'admin',
        joinedCrewAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewA', 'private', 'settings'), {
        inviteCode: 'ALPHA123',
        updatedAt: now,
      }),
      setDoc(doc(db, 'crewInviteCodes', 'ALPHA123'), {
        code: 'ALPHA123',
        crewId: 'crewA',
        createdBy: 'alice',
        createdAt: now,
      }),
      setDoc(doc(db, 'crews', 'crewA', 'rides', 'ride1'), {
        id: 'ride1',
        crewId: 'crewA',
        title: 'Sunday Ride',
        description: 'Test ride',
        dateTime: now,
        estimatedDuration: '2h',
        estimatedDistance: 42,
        pace: 'moderate',
        notes: '',
        coverImage: '',
        createdBy: 'alice',
        createdByName: 'Alice',
        attendees: [],
        checkedIn: [],
        status: 'upcoming',
        photos: [],
      }),
      setDoc(doc(db, 'crews', 'crewA', 'announcements', 'annExisting'), {
        id: 'annExisting',
        crewId: 'crewA',
        authorId: 'alice',
        authorName: 'Alice',
        authorAvatar: '',
        authorRole: 'admin',
        title: 'Existing',
        content: 'Existing announcement.',
        isPinned: false,
        imageUrl: null,
        createdAt: now,
      }),
      uploadString(ref(storage, 'users/alice/avatar.jpg'), 'avatar'),
    ]);
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync(join(__dirname, '..', 'firestore.rules'), 'utf8'),
    },
    storage: {
      rules: readFileSync(join(__dirname, '..', 'storage.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  if (typeof testEnv.clearStorage === 'function') {
    await testEnv.clearStorage();
  }
  await seedData();
});

after(async () => {
  await testEnv.cleanup();
});

test('users can read and update only their own profile', async () => {
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  const dylanDb = testEnv.authenticatedContext('dylan').firestore();

  await assertSucceeds(getDoc(doc(aliceDb, 'users', 'alice')));
  await assertSucceeds(updateDoc(doc(aliceDb, 'users', 'alice'), { name: 'Alice Rider' }));
  await assertFails(getDoc(doc(dylanDb, 'users', 'alice')));
  await assertFails(updateDoc(doc(dylanDb, 'users', 'dylan'), { role: 'admin' }));
});

test('discoverable crews are visible, private crews are not', async () => {
  const outsiderDb = testEnv.authenticatedContext('dylan').firestore();

  await assertSucceeds(getDoc(doc(outsiderDb, 'crews', 'crewA')));
  await assertFails(getDoc(doc(outsiderDb, 'crews', 'crewPrivate')));
  await assertFails(getDoc(doc(outsiderDb, 'crews', 'crewA', 'private', 'settings')));
  await assertFails(getDoc(doc(outsiderDb, 'crewInviteCodes', 'ALPHA123')));
});

test('leaders can write announcements, members cannot', async () => {
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  const caraDb = testEnv.authenticatedContext('cara').firestore();
  const devDb = testEnv.authenticatedContext('dev').firestore();
  const mirrorAdminDb = testEnv.authenticatedContext('mirrorAdmin').firestore();

  await assertSucceeds(
    setDoc(doc(aliceDb, 'crews', 'crewA', 'announcements', 'ann1'), {
      id: 'ann1',
      crewId: 'crewA',
      authorId: 'alice',
      authorName: 'Alice',
      authorAvatar: '',
      authorRole: 'admin',
      title: 'Heads up',
      content: 'Bring fuel.',
      isPinned: false,
      createdAt: now,
    })
  );

  await assertSucceeds(
    setDoc(doc(devDb, 'crews', 'crewDev', 'announcements', 'ann-dev'), {
      id: 'ann-dev',
      crewId: 'crewDev',
      authorId: 'dev',
      authorName: 'Developer Support',
      authorAvatar: '',
      authorRole: 'admin',
      title: 'Support test',
      content: 'Testing announcement access.',
      isPinned: false,
      createdAt: now,
    })
  );

  await assertSucceeds(
    setDoc(doc(mirrorAdminDb, 'crews', 'crewA', 'announcements', 'ann-mirror'), {
      id: 'ann-mirror',
      crewId: 'crewA',
      authorId: 'mirrorAdmin',
      authorName: 'Mirror Admin',
      authorAvatar: '',
      authorRole: 'admin',
      title: 'Mirror admin',
      content: 'User role can recover stale member role.',
      isPinned: false,
      createdAt: now,
    })
  );

  await assertFails(
    setDoc(doc(caraDb, 'crews', 'crewA', 'announcements', 'ann2'), {
      id: 'ann2',
      crewId: 'crewA',
      authorId: 'cara',
      authorName: 'Cara',
      authorAvatar: '',
      authorRole: 'member',
      title: 'Not allowed',
      content: 'Nope',
      isPinned: false,
      createdAt: now,
    })
  );
});

test('members can like announcements but not edit them', async () => {
  const caraDb = testEnv.authenticatedContext('cara').firestore();
  const dylanDb = testEnv.authenticatedContext('dylan').firestore();
  const annRef = doc(caraDb, 'crews', 'crewA', 'announcements', 'annExisting');

  await assertSucceeds(updateDoc(annRef, { likedBy: ['cara'] }));
  await assertFails(updateDoc(annRef, { title: 'Hijacked' }));
  await assertFails(updateDoc(annRef, { likedBy: ['cara'], title: 'Hijacked' }));
  await assertFails(
    updateDoc(doc(dylanDb, 'crews', 'crewA', 'announcements', 'annExisting'), { likedBy: ['dylan'] })
  );
});

test('members can update ride attendance but not protected ride fields', async () => {
  const caraDb = testEnv.authenticatedContext('cara').firestore();
  const rideRef = doc(caraDb, 'crews', 'crewA', 'rides', 'ride1');

  await assertSucceeds(updateDoc(rideRef, { attendees: ['cara'] }));
  await assertSucceeds(updateDoc(rideRef, { checkedIn: ['cara'] }));
  await assertSucceeds(
    updateDoc(rideRef, {
      photos: [
        {
          id: 'photo1',
          rideId: 'ride1',
          uploadedBy: 'cara',
          uploadedByName: 'Cara',
          imageUrl: 'https://example.com/photo.jpg',
          uploadedAt: now,
        },
      ],
    })
  );
  await assertFails(updateDoc(rideRef, { title: 'Hijacked title' }));
});

test('crew members can chat on rides; status posts require attendance', async () => {
  const caraDb = testEnv.authenticatedContext('cara').firestore();
  const bobDb = testEnv.authenticatedContext('bob').firestore();
  const dylanDb = testEnv.authenticatedContext('dylan').firestore();

  // Any crew participant can post a chat message as themselves.
  await assertSucceeds(
    setDoc(doc(caraDb, 'crews', 'crewA', 'rides', 'ride1', 'messages', 'msg1'), {
      rideId: 'ride1',
      userId: 'cara',
      userName: 'Cara',
      type: 'chat',
      text: 'Rolling out soon?',
      createdAt: now,
    })
  );

  // Cannot spoof another user.
  await assertFails(
    setDoc(doc(caraDb, 'crews', 'crewA', 'rides', 'ride1', 'messages', 'msg2'), {
      rideId: 'ride1',
      userId: 'bob',
      userName: 'Bob',
      type: 'chat',
      text: 'Spoofed',
      createdAt: now,
    })
  );

  // Outsiders cannot read or post.
  await assertFails(getDoc(doc(dylanDb, 'crews', 'crewA', 'rides', 'ride1', 'messages', 'msg1')));
  await assertFails(
    setDoc(doc(dylanDb, 'crews', 'crewA', 'rides', 'ride1', 'messages', 'msg3'), {
      rideId: 'ride1',
      userId: 'dylan',
      userName: 'Dylan',
      type: 'chat',
      text: 'Not in this crew',
      createdAt: now,
    })
  );

  // Status posts require being an attendee, even for leaders.
  const bobStatus = {
    rideId: 'ride1',
    userId: 'bob',
    userName: 'Bob',
    type: 'status',
    status: 'on_my_way',
    text: 'On my way',
    createdAt: now,
  };
  await assertFails(
    setDoc(doc(bobDb, 'crews', 'crewA', 'rides', 'ride1', 'messages', 'status1'), bobStatus)
  );
  await assertSucceeds(updateDoc(doc(bobDb, 'crews', 'crewA', 'rides', 'ride1'), { attendees: ['bob'] }));
  await assertSucceeds(
    setDoc(doc(bobDb, 'crews', 'crewA', 'rides', 'ride1', 'messages', 'status1'), bobStatus)
  );

  // Messages are immutable; authors can delete their own.
  await assertFails(
    updateDoc(doc(caraDb, 'crews', 'crewA', 'rides', 'ride1', 'messages', 'msg1'), { text: 'edited' })
  );
  await assertSucceeds(deleteDoc(doc(caraDb, 'crews', 'crewA', 'rides', 'ride1', 'messages', 'msg1')));
});

test('RSVP, check-in, and ride chat stay available when the club subscription is inactive', async () => {
  const caraDb = testEnv.authenticatedContext('cara').firestore();
  const rideRef = doc(caraDb, 'crews', 'crewUnpaid', 'rides', 'rideU');

  // Core safety features are never paywalled.
  await assertSucceeds(updateDoc(rideRef, { attendees: ['cara'] }));
  await assertSucceeds(updateDoc(rideRef, { checkedIn: ['cara'] }));
  await assertSucceeds(
    setDoc(doc(caraDb, 'crews', 'crewUnpaid', 'rides', 'rideU', 'messages', 'chat1'), {
      rideId: 'rideU',
      userId: 'cara',
      userName: 'Cara',
      type: 'chat',
      text: 'Anyone riding today?',
      createdAt: now,
    })
  );
  await assertSucceeds(
    setDoc(doc(caraDb, 'crews', 'crewUnpaid', 'rides', 'rideU', 'messages', 'status1'), {
      rideId: 'rideU',
      userId: 'cara',
      userName: 'Cara',
      type: 'status',
      status: 'on_my_way',
      text: 'On my way',
      createdAt: now,
    })
  );

  // Photo posting stays behind the club subscription.
  await assertFails(
    updateDoc(rideRef, {
      photos: [
        {
          id: 'photoU',
          rideId: 'rideU',
          uploadedBy: 'cara',
          uploadedByName: 'Cara',
          imageUrl: 'https://example.com/photo.jpg',
          uploadedAt: now,
        },
      ],
    })
  );
});

test('a denied join request can be resubmitted by its owner only', async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'crews', 'crewA', 'joinRequests', 'dylan'), {
      id: 'dylan',
      crewId: 'crewA',
      userId: 'dylan',
      userName: 'Dylan',
      userEmail: 'dylan@example.com',
      userAvatar: '',
      status: 'denied',
      createdAt: now,
      decidedAt: now,
      decidedBy: 'alice',
    });
  });

  const dylanDb = testEnv.authenticatedContext('dylan').firestore();
  const caraDb = testEnv.authenticatedContext('cara').firestore();
  const resubmission = {
    id: 'dylan',
    crewId: 'crewA',
    userId: 'dylan',
    userName: 'Dylan',
    userEmail: 'dylan@example.com',
    userAvatar: '',
    status: 'pending',
    createdAt: now,
  };

  // Someone else cannot flip Dylan's denied request.
  await assertFails(setDoc(doc(caraDb, 'crews', 'crewA', 'joinRequests', 'dylan'), resubmission));
  // Dylan can resubmit his own denied request back to pending.
  await assertSucceeds(setDoc(doc(dylanDb, 'crews', 'crewA', 'joinRequests', 'dylan'), resubmission));
  // Once pending again, a further self-update is rejected (admins decide from here).
  await assertFails(
    updateDoc(doc(dylanDb, 'crews', 'crewA', 'joinRequests', 'dylan'), { status: 'approved' })
  );
});

test('members cannot create rides or albums', async () => {
  const caraDb = testEnv.authenticatedContext('cara').firestore();

  await assertFails(
    setDoc(doc(caraDb, 'crews', 'crewA', 'rides', 'memberRide'), {
      id: 'memberRide',
      crewId: 'crewA',
      title: 'Member Ride',
      description: 'Members cannot create rides.',
      dateTime: now,
      estimatedDuration: '1h',
      estimatedDistance: 12,
      pace: 'moderate',
      notes: '',
      coverImage: '',
      createdBy: 'cara',
      createdByName: 'Cara',
      attendees: [],
      checkedIn: [],
      status: 'upcoming',
      photos: [],
    })
  );

  await assertFails(
    setDoc(doc(caraDb, 'crews', 'crewA', 'albums', 'memberAlbum'), {
      id: 'memberAlbum',
      crewId: 'crewA',
      title: 'Member Album',
      description: '',
      coverImage: '',
      createdBy: 'cara',
      createdByName: 'Cara',
      createdAt: now,
      updatedAt: now,
      photos: [],
    })
  );
});

test('developer support can test paid features without activating subscription', async () => {
  const devDb = testEnv.authenticatedContext('dev').firestore();
  const devStorage = testEnv.authenticatedContext('dev').storage();

  await assertSucceeds(
    setDoc(doc(devDb, 'crews', 'crewDev', 'rides', 'devRide'), {
      id: 'devRide',
      crewId: 'crewDev',
      title: 'Support Ride',
      description: 'Testing paid access without subscription ownership.',
      dateTime: now,
      estimatedDuration: '1h',
      estimatedDistance: 12,
      pace: 'moderate',
      notes: '',
      coverImage: '',
      createdBy: 'dev',
      createdByName: 'Developer Support',
      attendees: [],
      checkedIn: [],
      status: 'upcoming',
      photos: [],
    })
  );
  await assertSucceeds(
    uploadString(ref(devStorage, 'crews/crewDev/rides/devRide/cover.jpg'), 'cover', 'raw', { contentType: 'image/jpeg' })
  );
  await assertSucceeds(
    uploadString(ref(devStorage, 'crews/crewDev/rides/devRide/photos/photo1.jpg'), 'photo', 'raw', { contentType: 'image/jpeg' })
  );
  await assertSucceeds(
    setDoc(doc(devDb, 'crews', 'crewDev', 'albums', 'devAlbum'), {
      id: 'devAlbum',
      crewId: 'crewDev',
      title: 'Support Album',
      description: '',
      coverImage: '',
      createdBy: 'dev',
      createdByName: 'Developer Support',
      createdAt: now,
      updatedAt: now,
      photos: [],
    })
  );
  await assertSucceeds(
    uploadString(ref(devStorage, 'crews/crewDev/albums/devAlbum/cover.jpg'), 'cover', 'raw', { contentType: 'image/jpeg' })
  );
  await assertSucceeds(
    uploadString(ref(devStorage, 'crews/crewDev/albums/devAlbum/photos/photo1.jpg'), 'photo', 'raw', { contentType: 'image/jpeg' })
  );
});

test('active paid crew unlocks rides and albums even when subscription owner member is stale', async () => {
  const aliceDb = testEnv.authenticatedContext('alice').firestore();

  await assertSucceeds(
    setDoc(doc(aliceDb, 'crews', 'crewStaleSubscription', 'rides', 'paidRide'), {
      id: 'paidRide',
      crewId: 'crewStaleSubscription',
      title: 'Paid Ride',
      description: 'A real paid subscription should unlock ride creation.',
      dateTime: now,
      estimatedDuration: '1h',
      estimatedDistance: 12,
      pace: 'moderate',
      notes: '',
      coverImage: '',
      createdBy: 'alice',
      createdByName: 'Alice',
      attendees: [],
      checkedIn: [],
      status: 'upcoming',
      photos: [],
    })
  );

  await assertSucceeds(
    setDoc(doc(aliceDb, 'crews', 'crewStaleSubscription', 'albums', 'paidAlbum'), {
      id: 'paidAlbum',
      crewId: 'crewStaleSubscription',
      title: 'Paid Album',
      description: '',
      coverImage: '',
      createdBy: 'alice',
      createdByName: 'Alice',
      createdAt: now,
      updatedAt: now,
      photos: [],
    })
  );
});

test('join requests are requester-created and leader-readable', async () => {
  const dylanDb = testEnv.authenticatedContext('dylan').firestore();
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  const caraDb = testEnv.authenticatedContext('cara').firestore();
  const requestRef = doc(dylanDb, 'crews', 'crewA', 'joinRequests', 'dylan');

  await assertSucceeds(
    setDoc(requestRef, {
      id: 'dylan',
      crewId: 'crewA',
      userId: 'dylan',
      userName: 'Dylan',
      userEmail: 'dylan@example.com',
      userAvatar: '',
      status: 'pending',
      createdAt: now,
    })
  );

  await assertSucceeds(getDoc(doc(aliceDb, 'crews', 'crewA', 'joinRequests', 'dylan')));
  await assertSucceeds(getDoc(doc(dylanDb, 'crews', 'crewA', 'joinRequests', 'dylan')));
  await assertFails(getDoc(doc(caraDb, 'crews', 'crewA', 'joinRequests', 'dylan')));
});

test('stats history stays server-owned', async () => {
  const aliceDb = testEnv.authenticatedContext('alice').firestore();

  await assertFails(
    setDoc(doc(aliceDb, 'crews', 'crewA', 'statsHistory', 'week-2026-03-23'), {
      id: 'week-2026-03-23',
      crewId: 'crewA',
      period: 'week',
      periodStart: now,
      periodEnd: now,
      totalRides: 1,
      totalMiles: 42,
      totalPhotos: 0,
      totalMembers: 3,
      createdAt: now,
    })
  );
});

test('storage rules enforce self-only avatars and image-typed uploads', async () => {
  // Storage rules are intentionally self-contained (see the header note in
  // storage.rules): cross-service firestore lookups don't work against this
  // project's named database, so crew paths accept any signed-in image upload
  // and Firestore rules remain the business-permission gate.
  const aliceStorage = testEnv.authenticatedContext('alice').storage();
  const caraStorage = testEnv.authenticatedContext('cara').storage();
  const dylanStorage = testEnv.authenticatedContext('dylan').storage();
  const anonStorage = testEnv.unauthenticatedContext().storage();
  const image = { contentType: 'image/jpeg' };

  // Avatars are strictly self-owned.
  await assertSucceeds(uploadString(ref(aliceStorage, 'users/alice/avatar.jpg'), 'fresh-avatar', 'raw', image));
  await assertFails(uploadString(ref(dylanStorage, 'users/alice/avatar.jpg'), 'nope', 'raw', image));
  await assertSucceeds(uploadString(ref(aliceStorage, 'users/alice/avatars/avatar-123.jpg'), 'fresh-avatar', 'raw', image));
  await assertFails(uploadString(ref(dylanStorage, 'users/alice/avatars/avatar-123.jpg'), 'nope', 'raw', image));

  // Crew media paths accept image uploads from any signed-in user.
  await assertSucceeds(uploadString(ref(caraStorage, 'crews/crewA/announcements/old-path.jpg'), 'announcement', 'raw', image));
  await assertSucceeds(uploadString(ref(aliceStorage, 'crews/crewA/announcements/annExisting/image.jpg'), 'announcement', 'raw', image));
  await assertSucceeds(uploadString(ref(aliceStorage, 'crews/crewA/rides/ride1/cover.jpg'), 'cover', 'raw', image));
  await assertSucceeds(uploadString(ref(caraStorage, 'crews/crewA/rides/ride1/photos/photo1.jpg'), 'photo', 'raw', image));

  // Non-image payloads, signed-out users, and unknown paths are rejected.
  await assertFails(
    uploadString(ref(caraStorage, 'crews/crewA/rides/ride1/photos/bad.jpg'), 'not-an-image', 'raw', {
      contentType: 'text/plain',
    })
  );
  await assertFails(uploadString(ref(anonStorage, 'crews/crewA/rides/ride1/photos/photo2.jpg'), 'photo', 'raw', image));
  await assertFails(uploadString(ref(aliceStorage, 'random/other.jpg'), 'nope', 'raw', image));
});
