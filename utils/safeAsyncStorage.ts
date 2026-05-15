import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStorage = new Map<string, string>();

function logStorageWarning(operation: string, key: string, error: unknown) {
  if (__DEV__) {
    console.log(`[AsyncStorage] ${operation} failed for ${key}:`, error);
  }
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
      logStorageWarning('getItem', key, error);
      return memoryStorage.get(key) ?? null;
    }
  },

  async setItem(key: string, value: string) {
    memoryStorage.set(key, value);
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      logStorageWarning('setItem', key, error);
    }
  },

  async removeItem(key: string) {
    memoryStorage.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      logStorageWarning('removeItem', key, error);
    }
  },
};

export default SafeAsyncStorage;
