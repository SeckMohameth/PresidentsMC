// Pin the timezone so date-formatting assertions are identical on any machine/CI.
process.env.TZ = 'America/New_York';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
