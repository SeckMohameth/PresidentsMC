/** Jest config for app logic + component tests.
 *  Firestore/Storage SECURITY RULES tests live in tests/ and run separately
 *  against the emulator via `bun run test:rules` — they are excluded here.
 */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/testing/jest.setup.ts'],
  moduleNameMapper: {
    // Never initialize the real Firebase app in unit tests.
    '^@/utils/firebase$': '<rootDir>/testing/mocks/firebaseApp.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/', '<rootDir>/functions/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|lucide-react-native|@nkzw/.*))',
  ],
  clearMocks: true,
};
