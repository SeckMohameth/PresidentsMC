import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '@/utils/firebase';

export function isRemoteImageUri(uri?: string | null) {
  if (!uri) return false;
  return uri.startsWith('http://') || uri.startsWith('https://');
}

export function isPersistedImageUri(uri?: string | null) {
  if (!uri) return false;
  return (
    uri.startsWith('https://firebasestorage.googleapis.com/') ||
    uri.includes('.firebasestorage.app/') ||
    uri.startsWith('https://images.unsplash.com/')
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

export async function uploadImageUri(uri: string, path: string) {
  if (!uri) return uri;
  if (isPersistedImageUri(uri)) return uri;

  const blob = await uriToBlob(uri);
  const storageRef = ref(storage, path);
  const contentType = getImageContentType(blob.type, path);
  await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(storageRef);
}

function uriToBlob(uri: string) {
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Unable to read selected image.'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}
