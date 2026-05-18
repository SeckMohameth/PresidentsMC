import { readFileSync } from 'node:fs';
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  deleteDoc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-presidents-mc';
const CLUB_ID = 'presidents-mc';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

function dbFor(uid) {
  return testEnv.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
}

function anonDb() {
  return testEnv.unauthenticatedContext().firestore();
}

async function bootstrapOwner(uid = 'owner') {
  const db = dbFor(uid);

  await assertSucceeds(setDoc(doc(db, 'users', uid), {
    id: uid,
    name: 'Club Owner',
    email: `${uid}@example.com`,
    avatar: '',
    crewId: CLUB_ID,
    pendingCrewId: null,
    role: 'admin',
  }));

  await assertSucceeds(setDoc(doc(db, 'crews', CLUB_ID), {
    id: CLUB_ID,
    name: 'PresidentsMC',
    nameLower: 'presidentsmc',
    description: 'Private biker club app',
    logoUrl: '',
    ownerId: uid,
    subscriptionOwnerId: uid,
    subscriptionStatus: 'inactive',
    billingRequired: false,
    memberCount: 1,
    status: 'active',
    isDiscoverable: false,
    requiresApproval: true,
    createdAt: new Date().toISOString(),
    archivedAt: null,
    purgeAt: null,
  }));

  await assertSucceeds(setDoc(doc(db, 'crews', CLUB_ID, 'private', 'settings'), {
    inviteCode: 'ABC123',
    updatedAt: new Date().toISOString(),
  }));

  await assertSucceeds(setDoc(doc(db, 'crews', CLUB_ID, 'members', uid), {
    id: uid,
    name: 'Club Owner',
    email: `${uid}@example.com`,
    avatar: '',
    role: 'admin',
    joinedAt: new Date().toISOString(),
    joinedCrewAt: new Date().toISOString(),
  }));
}

async function seedMember(uid, role = 'member') {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', uid), {
      id: uid,
      name: uid,
      email: `${uid}@example.com`,
      avatar: '',
      crewId: CLUB_ID,
      pendingCrewId: null,
      role,
    });
    await setDoc(doc(db, 'crews', CLUB_ID, 'members', uid), {
      id: uid,
      name: uid,
      email: `${uid}@example.com`,
      avatar: '',
      role,
      joinedAt: new Date().toISOString(),
      joinedCrewAt: new Date().toISOString(),
    });
  });
}

test('denies public reads from the club document', async () => {
  await bootstrapOwner();
  await assertFails(getDoc(doc(anonDb(), 'crews', CLUB_ID)));
});

test('lets the club owner create a ride even before subscription activation', async () => {
  await bootstrapOwner();
  const db = dbFor('owner');

  await assertSucceeds(setDoc(doc(db, 'crews', CLUB_ID, 'rides', 'ride-1'), {
    id: 'ride-1',
    title: 'Sunday Ride',
    description: 'Point A to point B',
    startLocation: { name: 'Start', address: 'Hartford, CT', latitude: 41.7658, longitude: -72.6734 },
    endLocation: { name: 'End', address: 'New Haven, CT', latitude: 41.3083, longitude: -72.9279 },
    dateTime: new Date().toISOString(),
    estimatedDuration: 90,
    estimatedDistance: 34,
    pace: 'moderate',
    notes: '',
    coverImage: '',
    createdBy: 'owner',
    createdByName: 'Club Owner',
    attendees: ['owner'],
    checkedIn: [],
    photos: [],
    status: 'upcoming',
  }));
});

test('blocks non-owner leaders when the subscription is inactive', async () => {
  await bootstrapOwner();
  await seedMember('officer', 'officer');
  const db = dbFor('officer');

  await assertFails(setDoc(doc(db, 'crews', CLUB_ID, 'rides', 'ride-2'), {
    id: 'ride-2',
    title: 'Officer Ride',
    createdBy: 'officer',
    status: 'upcoming',
  }));
});

test('allows signed-in non-members to request access but not read the club', async () => {
  await bootstrapOwner();
  const db = dbFor('prospect');

  await assertSucceeds(setDoc(doc(db, 'users', 'prospect'), {
    id: 'prospect',
    name: 'Prospect',
    email: 'prospect@example.com',
    avatar: '',
    crewId: null,
    pendingCrewId: null,
    role: 'member',
  }));

  await assertSucceeds(setDoc(doc(db, 'crews', CLUB_ID, 'joinRequests', 'prospect'), {
    id: 'prospect',
    userId: 'prospect',
    userName: 'Prospect',
    userEmail: 'prospect@example.com',
    crewId: CLUB_ID,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }));

  await assertFails(getDoc(doc(db, 'crews', CLUB_ID)));
  assert.ok(true);
});

test('lets denied prospects request again but does not allow canceling pending requests', async () => {
  await bootstrapOwner();
  const db = dbFor('prospect');
  const requestRef = doc(db, 'crews', CLUB_ID, 'joinRequests', 'prospect');

  await assertSucceeds(setDoc(doc(db, 'users', 'prospect'), {
    id: 'prospect',
    name: 'Prospect',
    email: 'prospect@example.com',
    avatar: '',
    crewId: null,
    pendingCrewId: null,
    role: 'member',
  }));

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'crews', CLUB_ID, 'joinRequests', 'prospect'), {
      id: 'prospect',
      userId: 'prospect',
      userName: 'Prospect',
      userEmail: 'prospect@example.com',
      crewId: CLUB_ID,
      status: 'denied',
      createdAt: new Date().toISOString(),
      decidedAt: new Date().toISOString(),
      decidedBy: 'owner',
    });
  });

  await assertSucceeds(setDoc(requestRef, {
    id: 'prospect',
    userId: 'prospect',
    userName: 'Prospect',
    userEmail: 'prospect@example.com',
    crewId: CLUB_ID,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }));

  await assertFails(deleteDoc(requestRef));
});

test('lets members update safe profile fields but not role or hierarchy title', async () => {
  await bootstrapOwner();
  await seedMember('member');
  const db = dbFor('member');

  await assertSucceeds(updateDoc(doc(db, 'users', 'member'), {
    bike: 'Harley-Davidson Street Glide',
  }));

  await assertFails(updateDoc(doc(db, 'users', 'member'), {
    role: 'admin',
  }));

  await assertFails(updateDoc(doc(db, 'users', 'member'), {
    leadershipTitle: 'President',
  }));

  await assertFails(updateDoc(doc(db, 'crews', CLUB_ID, 'members', 'member'), {
    leadershipTitle: 'Road Captain',
  }));
});

test('lets members like announcements, RSVP, check in, and add ride photos only', async () => {
  await bootstrapOwner();
  await seedMember('member');

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'crews', CLUB_ID, 'announcements', 'announcement-1'), {
      id: 'announcement-1',
      crewId: CLUB_ID,
      title: 'Club Update',
      content: 'Meeting tonight.',
      likedBy: [],
      createdAt: new Date().toISOString(),
    });
    await setDoc(doc(adminDb, 'crews', CLUB_ID, 'rides', 'ride-member'), {
      id: 'ride-member',
      title: 'Member Ride',
      attendees: [],
      checkedIn: [],
      photos: [],
      status: 'upcoming',
    });
  });

  const db = dbFor('member');
  await assertSucceeds(updateDoc(doc(db, 'crews', CLUB_ID, 'announcements', 'announcement-1'), {
    likedBy: ['member'],
  }));
  await assertFails(updateDoc(doc(db, 'crews', CLUB_ID, 'announcements', 'announcement-1'), {
    title: 'Changed by member',
  }));

  await assertSucceeds(updateDoc(doc(db, 'crews', CLUB_ID, 'rides', 'ride-member'), {
    attendees: ['member'],
    checkedIn: ['member'],
    photos: [{
      id: 'photo-1',
      rideId: 'ride-member',
      uploadedBy: 'member',
      uploadedByName: 'member',
      imageUrl: 'https://example.com/photo.jpg',
      uploadedAt: new Date().toISOString(),
    }],
  }));
  await assertFails(updateDoc(doc(db, 'crews', CLUB_ID, 'rides', 'ride-member'), {
    title: 'Changed by member',
  }));
});

test('allows officer admin tools when billing is disabled and gates them when enabled', async () => {
  await bootstrapOwner();
  await seedMember('officer', 'officer');
  const officerDb = dbFor('officer');
  const crewRef = doc(dbFor('owner'), 'crews', CLUB_ID);

  await assertSucceeds(setDoc(doc(officerDb, 'crews', CLUB_ID, 'announcements', 'officer-open'), {
    id: 'officer-open',
    crewId: CLUB_ID,
    title: 'Open billing',
    content: 'Officer can post during beta.',
    likedBy: [],
    createdAt: new Date().toISOString(),
  }));

  await assertSucceeds(updateDoc(crewRef, {
    billingRequired: true,
  }));

  await assertFails(setDoc(doc(officerDb, 'crews', CLUB_ID, 'announcements', 'officer-gated'), {
    id: 'officer-gated',
    crewId: CLUB_ID,
    title: 'Gated billing',
    content: 'Should fail while inactive.',
    likedBy: [],
    createdAt: new Date().toISOString(),
  }));

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), 'crews', CLUB_ID), {
      subscriptionStatus: 'active',
    });
  });

  await assertSucceeds(setDoc(doc(officerDb, 'crews', CLUB_ID, 'announcements', 'officer-active'), {
    id: 'officer-active',
    crewId: CLUB_ID,
    title: 'Active billing',
    content: 'Should pass while active.',
    likedBy: [],
    createdAt: new Date().toISOString(),
  }));
});

test('blocks regular members from creating admin content', async () => {
  await bootstrapOwner();
  await seedMember('member');
  const db = dbFor('member');

  await assertFails(setDoc(doc(db, 'crews', CLUB_ID, 'announcements', 'member-post'), {
    id: 'member-post',
    crewId: CLUB_ID,
    title: 'Not allowed',
    content: 'Members cannot post announcements.',
    likedBy: [],
    createdAt: new Date().toISOString(),
  }));

  await assertFails(setDoc(doc(db, 'crews', CLUB_ID, 'rides', 'member-ride'), {
    id: 'member-ride',
    title: 'Not allowed',
    createdBy: 'member',
    status: 'upcoming',
  }));
});
