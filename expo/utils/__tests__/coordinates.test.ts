import { hasUsableCoordinates } from '@/utils/coordinates';

describe('hasUsableCoordinates', () => {
  it('accepts real coordinates', () => {
    expect(hasUsableCoordinates({ latitude: 40.7128, longitude: -74.006 })).toBe(true);
    expect(hasUsableCoordinates({ latitude: -33.8688, longitude: 151.2093 })).toBe(true);
    expect(hasUsableCoordinates({ latitude: 90, longitude: 180 })).toBe(true);
    expect(hasUsableCoordinates({ latitude: -90, longitude: -180 })).toBe(true);
  });

  it('rejects the 0,0 placeholder that typed-but-not-geocoded addresses used to save', () => {
    expect(hasUsableCoordinates({ latitude: 0, longitude: 0 })).toBe(false);
  });

  it('accepts a coordinate where only one axis is 0', () => {
    expect(hasUsableCoordinates({ latitude: 0, longitude: -74.006 })).toBe(true);
    expect(hasUsableCoordinates({ latitude: 40.7128, longitude: 0 })).toBe(true);
  });

  it('rejects missing locations', () => {
    expect(hasUsableCoordinates(undefined)).toBe(false);
    expect(hasUsableCoordinates(null)).toBe(false);
  });

  it('rejects non-finite coordinates', () => {
    expect(hasUsableCoordinates({ latitude: NaN, longitude: -74 })).toBe(false);
    expect(hasUsableCoordinates({ latitude: 40, longitude: NaN })).toBe(false);
    expect(hasUsableCoordinates({ latitude: Infinity, longitude: 0 })).toBe(false);
    expect(hasUsableCoordinates({ latitude: 40, longitude: -Infinity })).toBe(false);
  });

  it('rejects out-of-range coordinates', () => {
    expect(hasUsableCoordinates({ latitude: 90.0001, longitude: 0 })).toBe(false);
    expect(hasUsableCoordinates({ latitude: -91, longitude: 0 })).toBe(false);
    expect(hasUsableCoordinates({ latitude: 0, longitude: 180.5 })).toBe(false);
    expect(hasUsableCoordinates({ latitude: 0, longitude: -181 })).toBe(false);
  });
});
