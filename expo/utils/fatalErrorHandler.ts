// Intercepts JS fatal errors before they reach RCTExceptionsManager,
// which crashes on iOS 26 + New Architecture when ObjC exceptions propagate through C++.
// In this diagnostic build, the error is shown on screen via Alert.
import { Alert } from 'react-native';

const errorUtils = (globalThis as any).ErrorUtils;
if (errorUtils) {
  errorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
    const msg = error?.message ?? String(error);
    const stack = error?.stack?.substring(0, 800) ?? '';
    console.error('[FatalErrorHandler]', isFatal ? 'FATAL' : 'error', msg, stack);

    if (isFatal) {
      // Show on screen so we can read the error from a TestFlight device
      Alert.alert(
        'Debug: Startup Error',
        `${msg}\n\n${stack}`,
        [{ text: 'OK' }],
        { cancelable: false }
      );
      // Do NOT call original handler — that's what crashes the app via ExceptionsManager
    }
  });
}
