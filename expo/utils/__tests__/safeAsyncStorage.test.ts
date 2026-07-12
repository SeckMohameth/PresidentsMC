import AsyncStorage from '@react-native-async-storage/async-storage';
import SafeAsyncStorage from '@/utils/safeAsyncStorage';

describe('SafeAsyncStorage', () => {
  it('passes through to AsyncStorage when it works', async () => {
    await SafeAsyncStorage.setItem('k', 'v');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('k', 'v');
    await expect(SafeAsyncStorage.getItem('k')).resolves.toBe('v');
    await SafeAsyncStorage.removeItem('k');
    await expect(SafeAsyncStorage.getItem('k')).resolves.toBeNull();
  });

  it('falls back to in-memory storage when the native module throws', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await SafeAsyncStorage.setItem('key', 'memory-value');

    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('still broken'));
    await expect(SafeAsyncStorage.getItem('key')).resolves.toBe('memory-value');

    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('still broken'));
    await SafeAsyncStorage.removeItem('key');

    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('still broken'));
    await expect(SafeAsyncStorage.getItem('key')).resolves.toBeNull();
  });

  it('returns null (not a rejection) when everything fails on a missing key', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(SafeAsyncStorage.getItem('never-set')).resolves.toBeNull();
  });
});
