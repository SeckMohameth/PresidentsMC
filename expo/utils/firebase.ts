import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { getAuth, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

declare const require: (moduleName: string) => any;

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
const firestoreDatabaseId = process.env.EXPO_PUBLIC_FIRESTORE_DATABASE_ID || 'default';
const usesFirebaseDefaultDatabase = firestoreDatabaseId === '(default)';

const isConfigComplete = Object.values(firebaseConfig).every(Boolean);
if (!isConfigComplete) {
  console.warn(
    '[Firebase] Missing EXPO_PUBLIC_FIREBASE_* env vars. Check your .env or Expo config.'
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : (() => {
        try {
          const { getReactNativePersistence } = require('@firebase/auth');
          return initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage),
          });
        } catch {
          return getAuth(app);
        }
      })();
const db = usesFirebaseDefaultDatabase
  ? getFirestore(app)
  : getFirestore(app, firestoreDatabaseId);
const storage = getStorage(app);
const functions = getFunctions(app);

export { app, auth, db, storage, functions };
