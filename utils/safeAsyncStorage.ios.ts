// iOS-specific: pure in-memory storage — never imports or initializes the native
// AsyncStorage TurboModule. The native module performs background filesystem ops
// (creating ExponentExperienceData paths) that throw on iOS 26 / iPhone 16,
// crashing the app at startup via ObjCTurboModule::performVoidMethodInvocation.
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
