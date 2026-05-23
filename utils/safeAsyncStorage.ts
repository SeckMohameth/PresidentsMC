import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

const memoryStorage = new Map<string, string>();
const failedStorageKeys = new Set<string>();
let repairPromise: Promise<void> | null = null;

function logStorageWarning(operation: string, key: string, error: unknown) {
  const warningKey = `${operation}:${key}`;
  if (__DEV__ && !failedStorageKeys.has(warningKey)) {
    failedStorageKeys.add(warningKey);
    console.log(`[AsyncStorage] ${operation} failed for ${key}. Using in-memory fallback for this session.`, error);
  }
}

async function repairExpoStorageDirectory() {
  if (Platform.OS === 'web') return;

  if (!repairPromise) {
    repairPromise = (async () => {
      const roots = [FileSystem.documentDirectory, FileSystem.cacheDirectory].filter(Boolean);

      await Promise.all(
        roots.map(async (root) => {
          const basePath = `${root}ExponentExperienceData`;
          const anonymousPath = `${basePath}/@anonymous`;

          await FileSystem.makeDirectoryAsync(basePath, { intermediates: true }).catch(() => {});

          const info = await FileSystem.getInfoAsync(anonymousPath).catch(() => null);
          if (info?.exists && !info.isDirectory) {
            await FileSystem.deleteAsync(anonymousPath, { idempotent: true }).catch(() => {});
          }

          await FileSystem.makeDirectoryAsync(anonymousPath, { intermediates: true }).catch(() => {});
        })
      );
    })().finally(() => {
      repairPromise = null;
    });
  }

  await repairPromise;
}

const SafeAsyncStorage = {
  async getItem(key: string) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value != null) {
        memoryStorage.set(key, value);
      }
      return value ?? memoryStorage.get(key) ?? null;
    } catch (error) {
      await repairExpoStorageDirectory();
      try {
        const value = await AsyncStorage.getItem(key);
        if (value != null) {
          memoryStorage.set(key, value);
        }
        return value ?? memoryStorage.get(key) ?? null;
      } catch {
        // Fall through to the in-memory copy for this session.
      }
      logStorageWarning('getItem', key, error);
      return memoryStorage.get(key) ?? null;
    }
  },

  async setItem(key: string, value: string) {
    memoryStorage.set(key, value);
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      await repairExpoStorageDirectory();
      try {
        await AsyncStorage.setItem(key, value);
        return;
      } catch {
        // Fall through to the warning and in-memory persistence.
      }
      logStorageWarning('setItem', key, error);
    }
  },

  async removeItem(key: string) {
    memoryStorage.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      await repairExpoStorageDirectory();
      try {
        await AsyncStorage.removeItem(key);
        return;
      } catch {
        // Fall through to the warning.
      }
      logStorageWarning('removeItem', key, error);
    }
  },
};

export default SafeAsyncStorage;
