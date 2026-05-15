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
  getDoc,
  setDoc,
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
