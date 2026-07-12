import {
  deleteFirebaseStorageUri,
  getImageContentType,
  isFirebaseStorageUri,
  isPersistedImageUri,
  isRemoteImageUri,
  uploadImageUri,
} from '@/utils/storageUpload';
import { deleteObject, ref, uploadBytes } from 'firebase/storage';

jest.mock('firebase/storage', () => ({
  ref: jest.fn((_storage: unknown, path: string) => ({ path })),
  deleteObject: jest.fn(async () => undefined),
  uploadBytes: jest.fn(async () => undefined),
  getDownloadURL: jest.fn(async () => 'https://firebasestorage.googleapis.com/v0/b/x/o/uploaded.jpg'),
}));

const FIREBASE_URL =
  'https://firebasestorage.googleapis.com/v0/b/pmc.appspot.com/o/avatars%2Fuser-1%2Fphoto.jpg?alt=media&token=abc';

describe('URI classification', () => {
  it('isRemoteImageUri accepts only http(s)', () => {
    expect(isRemoteImageUri('https://x.com/a.jpg')).toBe(true);
    expect(isRemoteImageUri('http://x.com/a.jpg')).toBe(true);
    expect(isRemoteImageUri('file:///tmp/a.jpg')).toBe(false);
    expect(isRemoteImageUri('')).toBe(false);
    expect(isRemoteImageUri(null)).toBe(false);
    expect(isRemoteImageUri(undefined)).toBe(false);
  });

  it('isPersistedImageUri recognizes storage, unsplash, and preset images', () => {
    expect(isPersistedImageUri(FIREBASE_URL)).toBe(true);
    expect(isPersistedImageUri('https://pmc.firebasestorage.app/o/a.jpg')).toBe(true);
    expect(isPersistedImageUri('https://images.unsplash.com/photo-1')).toBe(true);
    expect(isPersistedImageUri('preset://cover/3')).toBe(true);
    expect(isPersistedImageUri('file:///var/mobile/tmp/picked.jpg')).toBe(false);
    expect(isPersistedImageUri(null)).toBe(false);
  });

  it('isFirebaseStorageUri only matches our storage hosts', () => {
    expect(isFirebaseStorageUri(FIREBASE_URL)).toBe(true);
    expect(isFirebaseStorageUri('https://pmc.firebasestorage.app/o/a.jpg')).toBe(true);
    expect(isFirebaseStorageUri('https://images.unsplash.com/photo-1')).toBe(false);
    expect(isFirebaseStorageUri(undefined)).toBe(false);
  });
});

describe('getImageContentType', () => {
  it('prefers a real image blob type', () => {
    expect(getImageContentType('image/png', 'photo.jpg')).toBe('image/png');
  });

  it('ignores non-image blob types and derives from the path', () => {
    expect(getImageContentType('application/octet-stream', 'a.PNG')).toBe('image/png');
    expect(getImageContentType(undefined, 'a.webp')).toBe('image/webp');
    expect(getImageContentType(undefined, 'a.heic')).toBe('image/heic');
    expect(getImageContentType(undefined, 'a.HEIF')).toBe('image/heic');
  });

  it('defaults to jpeg', () => {
    expect(getImageContentType(undefined, 'photo.jpg')).toBe('image/jpeg');
    expect(getImageContentType(undefined, undefined)).toBe('image/jpeg');
  });
});

describe('uploadImageUri short-circuits', () => {
  it('returns falsy input untouched without hitting storage', async () => {
    await expect(uploadImageUri('', 'x/y.jpg')).resolves.toBe('');
    expect(uploadBytes).not.toHaveBeenCalled();
  });

  it('returns already-persisted URIs untouched without re-uploading', async () => {
    await expect(uploadImageUri(FIREBASE_URL, 'x/y.jpg')).resolves.toBe(FIREBASE_URL);
    await expect(uploadImageUri('preset://cover/3', 'x/y.jpg')).resolves.toBe('preset://cover/3');
    expect(uploadBytes).not.toHaveBeenCalled();
  });
});

describe('deleteFirebaseStorageUri', () => {
  it('does nothing for non-storage URIs (never deletes unsplash/presets)', async () => {
    await deleteFirebaseStorageUri('https://images.unsplash.com/photo-1');
    await deleteFirebaseStorageUri('preset://cover/3');
    await deleteFirebaseStorageUri(undefined);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('decodes the object path out of a download URL before deleting', async () => {
    await deleteFirebaseStorageUri(FIREBASE_URL);
    expect(ref).toHaveBeenCalledWith(expect.anything(), 'avatars/user-1/photo.jpg');
    expect(deleteObject).toHaveBeenCalledTimes(1);
  });

  it('swallows object-not-found (already deleted) errors', async () => {
    (deleteObject as jest.Mock).mockRejectedValueOnce({ code: 'storage/object-not-found' });
    await expect(deleteFirebaseStorageUri(FIREBASE_URL)).resolves.toBeUndefined();
  });

  it('rethrows real storage errors', async () => {
    (deleteObject as jest.Mock).mockRejectedValueOnce({ code: 'storage/unauthorized' });
    await expect(deleteFirebaseStorageUri(FIREBASE_URL)).rejects.toEqual({ code: 'storage/unauthorized' });
  });
});
