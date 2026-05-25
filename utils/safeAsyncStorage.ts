import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const memoryStorage = new Map<string, string>();
const failedStorageKeys = new Set<string>();
let nativeStorageUnavailable = false;

function logStorageWarning(operation: string, key: string, error: unknown) {
  const warningKey = `${operation}:${key}`;
  if (__DEV__ && !failedStorageKeys.has(warningKey)) {
    failedStorageKeys.add(warningKey);
    console.log(`[AsyncStorage] ${operation} failed for ${key}. Using in-memory fallback for this session.`, error);
  }
}

async function prepareNativeStorage() {
  if (Platform.OS === 'ios') {
    return false;
  }

  if (nativeStorageUnavailable || Platform.OS === 'web') {
    return !nativeStorageUnavailable;
  }

  return true;
}

const SafeAsyncStorage = {
  async getItem(key: string) {
    if (!(await prepareNativeStorage())) {
      return memoryStorage.get(key) ?? null;
    }

    try {
      const value = await AsyncStorage.getItem(key);
      if (value != null) {
        memoryStorage.set(key, value);
      }
      return value ?? memoryStorage.get(key) ?? null;
    } catch (error) {
      nativeStorageUnavailable = true;
      logStorageWarning('getItem', key, error);
      return memoryStorage.get(key) ?? null;
    }
  },

  async setItem(key: string, value: string) {
    memoryStorage.set(key, value);
    if (!(await prepareNativeStorage())) {
      return;
    }

    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      nativeStorageUnavailable = true;
      logStorageWarning('setItem', key, error);
    }
  },

  async removeItem(key: string) {
    memoryStorage.delete(key);
    if (!(await prepareNativeStorage())) {
      return;
    }

    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      nativeStorageUnavailable = true;
      logStorageWarning('removeItem', key, error);
    }
  },
};

export default SafeAsyncStorage;
