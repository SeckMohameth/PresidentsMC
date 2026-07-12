import {
  DEFAULT_RIDE_DURATION_MS,
  getRideDurationMs,
  resolveRideStatus,
  RIDE_ACTIVE_GRACE_MS,
} from '@/utils/rideStatus';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

// Frozen "now" for every test so status boundaries are exact.
const NOW = new Date('2026-07-15T18:00:00.000Z').getTime();

const baseRide = {
  status: 'upcoming' as const,
  dateTime: new Date(NOW).toISOString(),
  estimatedDuration: '',
  routeDurationSeconds: undefined as number | undefined,
};

function rideStartingAt(offsetMsFromNow: number, overrides: Partial<typeof baseRide> = {}) {
  return {
    ...baseRide,
    dateTime: new Date(NOW + offsetMsFromNow).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getRideDurationMs', () => {
  it('prefers routeDurationSeconds when present', () => {
    expect(getRideDurationMs({ estimatedDuration: '5 hours', routeDurationSeconds: 5400 })).toBe(
      5400 * 1000
    );
  });

  it('ignores a zero/invalid routeDurationSeconds and falls back to the text', () => {
    expect(getRideDurationMs({ estimatedDuration: '1 hour', routeDurationSeconds: 0 })).toBe(HOUR);
    expect(getRideDurationMs({ estimatedDuration: '1 hour', routeDurationSeconds: NaN })).toBe(HOUR);
  });

  it.each([
    ['2 hours', 2 * HOUR],
    ['1 hour', HOUR],
    ['1.5 hrs', 1.5 * HOUR],
    ['3h', 3 * HOUR],
    ['90 minutes', 90 * MINUTE],
    ['45 min', 45 * MINUTE],
    ['30m', 30 * MINUTE],
    ['about 2 hours round trip', 2 * HOUR],
  ])('parses "%s" as %dms', (text, expected) => {
    expect(getRideDurationMs({ estimatedDuration: text, routeDurationSeconds: undefined })).toBe(
      expected
    );
  });

  it.each([['', undefined], ['all day', undefined], ['0 hours', undefined]])(
    'falls back to the 2h default for unparseable "%s"',
    (text) => {
      expect(getRideDurationMs({ estimatedDuration: text, routeDurationSeconds: undefined })).toBe(
        DEFAULT_RIDE_DURATION_MS
      );
    }
  );
});

describe('resolveRideStatus', () => {
  it('passes through non-upcoming statuses untouched, even for past dates', () => {
    expect(resolveRideStatus(rideStartingAt(-10 * HOUR, { status: 'cancelled' as any }))).toBe('cancelled');
    expect(resolveRideStatus(rideStartingAt(-10 * HOUR, { status: 'completed' as any }))).toBe('completed');
    expect(resolveRideStatus(rideStartingAt(-10 * HOUR, { status: 'active' as any }))).toBe('active');
  });

  it('stays upcoming before the start time', () => {
    expect(resolveRideStatus(rideStartingAt(1))).toBe('upcoming');
    expect(resolveRideStatus(rideStartingAt(3 * 24 * HOUR))).toBe('upcoming');
  });

  it('flips to active exactly at the start time (the old bug killed check-in here)', () => {
    expect(resolveRideStatus(rideStartingAt(0))).toBe('active');
  });

  it('stays active through the ride duration plus the grace window', () => {
    // 2h default duration + 2h grace = active until 4h after start.
    expect(resolveRideStatus(rideStartingAt(-1 * HOUR))).toBe('active');
    expect(resolveRideStatus(rideStartingAt(-(4 * HOUR) + 1))).toBe('active');
  });

  it('completes once duration + grace have fully elapsed', () => {
    expect(resolveRideStatus(rideStartingAt(-4 * HOUR))).toBe('completed');
    expect(resolveRideStatus(rideStartingAt(-24 * HOUR))).toBe('completed');
  });

  it('uses the route duration to extend the active window', () => {
    // 3h route + 2h grace: still active 4.5h in, completed at 5h.
    const threeHourRoute = { routeDurationSeconds: 3 * 3600 };
    expect(resolveRideStatus(rideStartingAt(-4.5 * HOUR, threeHourRoute))).toBe('active');
    expect(resolveRideStatus(rideStartingAt(-5 * HOUR, threeHourRoute))).toBe('completed');
  });

  it('uses the parsed estimated duration text to extend the active window', () => {
    const sixHours = { estimatedDuration: '6 hours' };
    expect(resolveRideStatus(rideStartingAt(-7 * HOUR, sixHours))).toBe('active');
    expect(resolveRideStatus(rideStartingAt(-8 * HOUR, sixHours))).toBe('completed');
  });

  it('leaves rides with an unparseable date upcoming instead of crashing', () => {
    expect(resolveRideStatus({ ...baseRide, dateTime: 'not-a-date' })).toBe('upcoming');
    expect(resolveRideStatus({ ...baseRide, dateTime: '' })).toBe('upcoming');
  });

  it('grace window constant matches the documented 2 hours', () => {
    expect(RIDE_ACTIVE_GRACE_MS).toBe(2 * HOUR);
  });
});
