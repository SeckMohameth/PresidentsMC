/**
 * One-time pre-launch cleanup of TEST content.
 *
 * Deletes ONLY (for crew "presidents-mc"):
 *   - Firestore docs in: announcements, rides, albums, statsHistory
 *   - Storage files under: crews/presidents-mc/{announcements,rides,albums}/
 *   - Resets the crew doc counters totalRides / totalMiles / totalPhotos to 0
 *
 * KEEPS everything else: the crew doc itself, members, private/settings,
 * users, crewInviteCodes, the club logo.jpg, and all user avatars/bike photos.
 *
 * Usage (run from the expo/functions directory):
 *   1) Firebase Console > Project settings > Service accounts >
 *      "Generate new private key". Save the file here as: serviceAccountKey.json
 *   2) node cleanup-test-data.js          # DRY RUN — shows what would be deleted
 *   3) node cleanup-test-data.js --yes    # actually delete
 *   4) Delete serviceAccountKey.json afterwards. NEVER commit it.
 */
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const PROJECT_ID = 'presidentsmc-50010';
const DATABASE_ID = 'default'; // named Firestore database (NOT "(default)")
const BUCKET = 'presidentsmc-50010.firebasestorage.app';
const CREW_ID = 'presidents-mc';
const SUBCOLLECTIONS = ['announcements', 'rides', 'albums'];
const STORAGE_PREFIXES = SUBCOLLECTIONS.map((c) => `crews/${CREW_ID}/${c}/`);

const APPLY = process.argv.includes('--yes');

let serviceAccount;
try {
  serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
} catch {
  console.error('\n✗ Missing serviceAccountKey.json in this folder.');
  console.error('  Firebase Console > Project settings > Service accounts > Generate new private key,');
  console.error('  save it here as  serviceAccountKey.json , then re-run.\n');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: BUCKET,
  projectId: PROJECT_ID,
});
const db = getFirestore(app, DATABASE_ID);
const bucket = getStorage(app).bucket();

async function main() {
  console.log(
    `\n${APPLY ? '⚠️  DELETING (live)' : '🔎 DRY RUN (no changes)'} — project ${PROJECT_ID}, db "${DATABASE_ID}", crew "${CREW_ID}"\n`
  );

  // 1) Firestore subcollections
  for (const sub of SUBCOLLECTIONS) {
    const col = db.collection('crews').doc(CREW_ID).collection(sub);
    const snap = await col.get();
    console.log(`Firestore  crews/${CREW_ID}/${sub}: ${snap.size} doc(s)`);
    if (APPLY && snap.size > 0) {
      await db.recursiveDelete(col);
      console.log(`   → deleted ${snap.size} doc(s)`);
    }
  }

  // 2) Storage folders
  for (const prefix of STORAGE_PREFIXES) {
    const [files] = await bucket.getFiles({ prefix });
    console.log(`Storage    ${prefix}: ${files.length} file(s)`);
    if (APPLY && files.length > 0) {
      await bucket.deleteFiles({ prefix });
      console.log(`   → deleted ${files.length} file(s)`);
    }
  }

  // 3) Reset crew counters
  console.log('Crew doc   reset totalRides / totalMiles / totalPhotos → 0');
  if (APPLY) {
    await db
      .collection('crews')
      .doc(CREW_ID)
      .set({ totalRides: 0, totalMiles: 0, totalPhotos: 0 }, { merge: true });
    console.log('   → counters reset');
  }

  console.log(
    `\n${APPLY ? '✅ Done.' : 'Dry run complete. Re-run with  --yes  to apply.'}\n` +
      'Kept untouched: crew doc, members, private/settings, users, crewInviteCodes, logo.jpg, avatars.\n'
  );
  process.exit(0);
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});
