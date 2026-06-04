import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { app, auth, storage } from '@/utils/firebase';

const IMAGE_READ_TIMEOUT_MS = 30_000;
const IMAGE_UPLOAD_TIMEOUT_MS = 60_000;

export function isRemoteImageUri(uri?: string | null) {
  if (!uri) return false;
  return uri.startsWith('http://') || uri.startsWith('https://');
}

export function isPersistedImageUri(uri?: string | null) {
  if (!uri) return false;
  return (
    uri.startsWith('https://firebasestorage.googleapis.com/') ||
    uri.includes('.firebasestorage.app/') ||
    uri.startsWith('https://images.unsplash.com/') ||
    uri.startsWith('preset://')
  );
}

export function getImageContentType(blobType?: string, path?: string) {
  if (blobType?.startsWith('image/')) return blobType;

  const lowerPath = path?.toLowerCase() || '';
  if (lowerPath.endsWith('.png')) return 'image/png';
  if (lowerPath.endsWith('.webp')) return 'image/webp';
  if (lowerPath.endsWith('.heic') || lowerPath.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export function isFirebaseStorageUri(uri?: string | null) {
  if (!uri) return false;
  return (
    uri.startsWith('https://firebasestorage.googleapis.com/') ||
    uri.includes('.firebasestorage.app/')
  );
}

async function logUploadDiagnostics(
  path: string,
  uri: string,
  blob: Blob,
  contentType: string
) {
  if (!__DEV__) return;
  const uid = auth.currentUser?.uid ?? null;
  let tokenStatus = 'no-current-user';
  if (auth.currentUser) {
    try {
      // Force-refresh ensures we surface a live token error rather than a stale cached one.
      await auth.currentUser.getIdTokenResult(true);
      tokenStatus = 'ok';
    } catch (error: any) {
      tokenStatus = `failed:${String(error?.code ?? error?.message ?? 'unknown')}`;
    }
  }
  console.log('[storageUpload] upload diagnostics', {
    path,
    uriScheme: uri.split(':')[0] || 'unknown',
    blobSize: blob.size,
    blobType: blob.type || '(empty)',
    contentType,
    authUid: uid,
    idToken: tokenStatus, // never logs the token itself
    appName: app.name,
    storageBucket: app.options.storageBucket ?? '(none)',
  });
}

export async function uploadImageUri(uri: string, path: string, explicitContentType?: string | null) {
  if (!uri) return uri;
  if (isPersistedImageUri(uri)) return uri;

  const blob = await withTimeout(uriToBlob(uri), IMAGE_READ_TIMEOUT_MS, 'Unable to read selected image.');
  const storageRef = ref(storage, path);
  const contentType = getImageContentType(explicitContentType || blob.type, path);
  await logUploadDiagnostics(path, uri, blob, contentType);
  await withTimeout(
    uploadBytes(storageRef, blob, { contentType }),
    IMAGE_UPLOAD_TIMEOUT_MS,
    'Image upload timed out. Please try a smaller photo or check your connection.'
  );
  return withTimeout(
    getDownloadURL(storageRef),
    IMAGE_READ_TIMEOUT_MS,
    'Unable to confirm uploaded image.'
  );
}

export async function deleteFirebaseStorageUri(uri?: string | null) {
  if (!isFirebaseStorageUri(uri)) return;
  const storagePath = getFirebaseStoragePathFromUri(uri ?? '');
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error: any) {
    const code = String(error?.code ?? '');
    if (code !== 'storage/object-not-found') {
      throw error;
    }
  }
}

function getFirebaseStoragePathFromUri(uri: string) {
  try {
    const url = new URL(uri);
    const encodedPath = url.pathname.includes('/o/')
      ? url.pathname.split('/o/')[1]
      : url.pathname.replace(/^\/+/, '');
    if (!encodedPath) return null;
    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
}

function uriToBlob(uri: string) {
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      const blob = xhr.response as Blob | null;
      if (!blob) {
        reject(new Error('Unable to read selected image.'));
        return;
      }
      resolve(blob);
    };
    xhr.onerror = () => reject(new Error('Unable to read selected image.'));
    xhr.ontimeout = () => reject(new Error('Unable to read selected image.'));
    xhr.responseType = 'blob';
    xhr.timeout = IMAGE_READ_TIMEOUT_MS;
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}
