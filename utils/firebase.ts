import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import * as FirebaseAuth from '@firebase/auth';
import { Platform } from 'react-native';
import SafeAsyncStorage from '@/utils/safeAsyncStorage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const isConfigComplete = Object.values(firebaseConfig).every(Boolean);
if (!isConfigComplete) {
  console.warn(
    '[Firebase] Missing EXPO_PUBLIC_FIREBASE_* env vars. Check your .env or Expo config.'
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const getReactNativePersistence = (
  FirebaseAuth as typeof FirebaseAuth & {
    getReactNativePersistence: (storage: typeof SafeAsyncStorage) => unknown;
  }
).getReactNativePersistence;

const auth =
  Platform.OS === 'web'
    ? FirebaseAuth.getAuth(app)
    : (() => {
        try {
          return FirebaseAuth.initializeAuth(app, {
            persistence: getReactNativePersistence(SafeAsyncStorage) as never,
          });
        } catch {
          return FirebaseAuth.getAuth(app);
        }
      })();
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

export { app, auth, db, storage, functions };
