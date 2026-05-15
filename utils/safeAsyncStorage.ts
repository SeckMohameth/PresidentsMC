import AsyncStorage from '@react-native-async-storage/async-storage';

function logStorageWarning(operation: string, key: string, error: unknown) {
  if (__DEV__) {
    console.log(`[AsyncStorage] ${operation} failed for ${key}:`, error);
  }
}

const SafeAsyncStorage = {
  async getItem(key: string) {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      logStorageWarning('getItem', key, error);
      return null;
    }
  },

  async setItem(key: string, value: string) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      logStorageWarning('setItem', key, error);
    }
  },

  async removeItem(key: string) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      logStorageWarning('removeItem', key, error);
    }
  },
};

export default SafeAsyncStorage;
