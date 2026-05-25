// Pure in-memory storage — no native module dependency.
// Resets on app restart; used for non-critical session state.
const memoryStorage = new Map<string, string>();

const SafeAsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    return memoryStorage.get(key) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    memoryStorage.set(key, value);
  },
  async removeItem(key: string): Promise<void> {
    memoryStorage.delete(key);
  },
};

export default SafeAsyncStorage;
