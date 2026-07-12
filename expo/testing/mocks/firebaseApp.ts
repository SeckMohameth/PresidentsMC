// Stand-in for @/utils/firebase in Jest (wired via moduleNameMapper) so unit
// tests never initialize a real Firebase app or touch the network. The SDK
// functions that consume these handles (doc, setDoc, httpsCallable, ref, …)
// are mocked per test file.
export const app = { name: 'test-app', options: { storageBucket: 'test-bucket' } };
export const auth = { currentUser: null as { uid: string } | null };
export const db = { __kind: 'firestore-stub' };
export const storage = { __kind: 'storage-stub' };
export const functions = { __kind: 'functions-stub' };
