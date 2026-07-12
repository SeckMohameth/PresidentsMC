import { Linking, Platform } from 'react-native';
import {
  calculateDistanceMiles,
  formatDate,
  formatDateTime,
  formatMiles,
  formatNumber,
  formatRelativeTime,
  formatTime,
  getDaysUntil,
  getInitials,
  getPaceColor,
  getPaceLabel,
  isToday,
  isUpcoming,
  openInMaps,
} from '@/utils/helpers';
import { Location } from '@/types';

// TZ is pinned to America/New_York in testing/jest.setup.ts.
const NOW = new Date('2026-07-15T18:00:00.000Z'); // 2:00 PM EDT, Wednesday

function setPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

const START: Location = { name: 'Clubhouse', address: '1 Main St', latitude: 40.7128, longitude: -74.006 };
const END: Location = { name: 'Bear Mountain', address: 'Bear Mountain, NY', latitude: 41.3126, longitude: -73.9887 };
const ZERO: Location = { name: 'Broken', address: 'typed address', latitude: 0, longitude: 0 };

describe('date formatting', () => {
  it('formats dates, date-times, and times in US style', () => {
    expect(formatDate('2026-07-04T12:00:00')).toBe('Sat, Jul 4');
    expect(formatDateTime('2026-07-04T09:05:00')).toBe('Sat, Jul 4, 9:05 AM');
    expect(formatTime('2026-07-04T21:30:00')).toBe('9:30 PM');
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('covers every bucket from just-now to calendar dates', () => {
    const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString();
    expect(formatRelativeTime(minutesAgo(0))).toBe('Just now');
    expect(formatRelativeTime(minutesAgo(5))).toBe('5m ago');
    expect(formatRelativeTime(minutesAgo(59))).toBe('59m ago');
    expect(formatRelativeTime(minutesAgo(60))).toBe('1h ago');
    expect(formatRelativeTime(minutesAgo(23 * 60))).toBe('23h ago');
    expect(formatRelativeTime(minutesAgo(24 * 60))).toBe('1d ago');
    expect(formatRelativeTime(minutesAgo(6 * 24 * 60))).toBe('6d ago');
    expect(formatRelativeTime(minutesAgo(7 * 24 * 60))).toBe('Wed, Jul 8');
  });
});

describe('number formatting', () => {
  it('formats miles with a k suffix at 1000', () => {
    expect(formatMiles(0)).toBe('0');
    expect(formatMiles(999)).toBe('999');
    expect(formatMiles(1000)).toBe('1.0k');
    expect(formatMiles(15250)).toBe('15.3k');
  });

  it('formats counts with k and M suffixes', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1500)).toBe('1.5k');
    expect(formatNumber(999999)).toBe('1000.0k');
    expect(formatNumber(2_500_000)).toBe('2.5M');
  });
});

describe('pace helpers', () => {
  it('maps each pace to its color and label', () => {
    expect(getPaceColor('casual')).toBe('#22C55E');
    expect(getPaceColor('moderate')).toBe('#FBBF24');
    expect(getPaceColor('spirited')).toBe('#EF4444');
    expect(getPaceLabel('casual')).toBe('Casual');
    expect(getPaceLabel('moderate')).toBe('Moderate');
    expect(getPaceLabel('spirited')).toBe('Spirited');
  });
});

describe('getInitials', () => {
  it('builds two-letter initials', () => {
    expect(getInitials('John Smith')).toBe('JS');
    expect(getInitials('cher')).toBe('C');
    expect(getInitials('mary jane watson')).toBe('MJ');
  });

  it('survives extra whitespace and empty names', () => {
    expect(getInitials('John  Smith')).toBe('JS');
    expect(getInitials('  John Smith  ')).toBe('JS');
    expect(getInitials('')).toBe('');
  });
});

describe('schedule helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('isUpcoming compares against now', () => {
    expect(isUpcoming(new Date(NOW.getTime() + 1000).toISOString())).toBe(true);
    expect(isUpcoming(new Date(NOW.getTime() - 1000).toISOString())).toBe(false);
  });

  it('isToday matches the local calendar day', () => {
    expect(isToday('2026-07-15T09:00:00')).toBe(true);
    expect(isToday('2026-07-16T09:00:00')).toBe(false);
    expect(isToday('2026-07-14T23:59:00')).toBe(false);
  });

  it('getDaysUntil rounds partial days up', () => {
    expect(getDaysUntil(new Date(NOW.getTime() + 1000).toISOString())).toBe(1);
    expect(getDaysUntil(new Date(NOW.getTime() + 3 * 86400000).toISOString())).toBe(3);
    // Math.ceil of a small negative diff is -0, which still renders as "0".
    expect(getDaysUntil(new Date(NOW.getTime() - 1000).toISOString())).toBe(-0);
    expect(getDaysUntil(new Date(NOW.getTime() - 25 * 3600000).toISOString())).toBe(-1);
  });
});

describe('calculateDistanceMiles', () => {
  it('matches known great-circle distances', () => {
    const nyc = { latitude: 40.7128, longitude: -74.006 };
    const la = { latitude: 34.0522, longitude: -118.2437 };
    expect(calculateDistanceMiles(nyc, la)).toBeCloseTo(2445, -1); // within ~5 miles
    expect(calculateDistanceMiles(nyc, nyc)).toBe(0);
  });

  it('measures one degree of latitude as ~69 miles', () => {
    const a = { latitude: 40, longitude: -74 };
    const b = { latitude: 41, longitude: -74 };
    expect(calculateDistanceMiles(a, b)).toBeCloseTo(69.1, 0);
  });
});

describe('openInMaps', () => {
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    setPlatform('ios');
  });

  afterEach(() => {
    openURL.mockRestore();
    setPlatform('ios');
  });

  it('refuses to route to a destination without usable coordinates', async () => {
    await expect(openInMaps(ZERO)).rejects.toThrow('INVALID_DESTINATION');
    expect(openURL).not.toHaveBeenCalled();
  });

  it('opens Apple Maps natively on iOS with the destination and label', async () => {
    await openInMaps(END, 'apple');
    expect(openURL).toHaveBeenCalledTimes(1);
    const url = openURL.mock.calls[0][0] as string;
    expect(url).toContain('maps://');
    expect(url).toContain('daddr=41.3126,-73.9887');
    expect(url).toContain(`q=${encodeURIComponent('Bear Mountain')}`);
  });

  it('includes the origin when it has usable coordinates', async () => {
    await openInMaps(END, 'apple', START);
    const url = openURL.mock.calls[0][0] as string;
    expect(url).toContain('saddr=40.7128,-74.006');
    expect(url).toContain('daddr=41.3126,-73.9887');
  });

  it('ignores a 0,0 origin instead of routing from the Atlantic Ocean', async () => {
    await openInMaps(END, 'apple', ZERO);
    const url = openURL.mock.calls[0][0] as string;
    expect(url).not.toContain('saddr');
  });

  it('falls back to the web URL when the native app is missing', async () => {
    openURL.mockRejectedValueOnce(new Error('no app'));
    await openInMaps(END, 'apple');
    expect(openURL).toHaveBeenCalledTimes(2);
    expect(openURL.mock.calls[1][0]).toContain('https://maps.apple.com/');
  });

  it('uses the Google Maps app scheme with directions mode', async () => {
    await openInMaps(END, 'google', START);
    const url = openURL.mock.calls[0][0] as string;
    expect(url).toContain('comgooglemaps://');
    expect(url).toContain('directionsmode=driving');
  });

  it('uses turn-by-turn google navigation on Android without an origin', async () => {
    setPlatform('android');
    await openInMaps(END, 'google');
    expect(openURL.mock.calls[0][0]).toBe('google.navigation:q=41.3126,-73.9887&mode=d');
  });

  it('routes through Waze with navigate=yes', async () => {
    await openInMaps(END, 'waze');
    expect(openURL.mock.calls[0][0]).toBe('waze://?ll=41.3126,-73.9887&navigate=yes');
    openURL.mockRejectedValueOnce(new Error('no app'));
    await openInMaps(END, 'waze');
    expect(openURL.mock.calls[2][0]).toContain('https://waze.com/ul');
  });

  it('always uses the Google web URL on web', async () => {
    setPlatform('web');
    await openInMaps(END, 'apple', START);
    const url = openURL.mock.calls[0][0] as string;
    expect(url).toContain('https://www.google.com/maps/dir/');
    expect(url).toContain('origin=40.7128,-74.006');
    expect(url).toContain('destination=41.3126,-73.9887');
  });
});
