// A location is only routable if it carries real coordinates. Rides created
// from a typed address without picking a suggestion/pin used to save 0,0 —
// treat that (and anything out of range) as "no coordinates".
export function hasUsableCoordinates(
  location?: { latitude: number; longitude: number } | null
): boolean {
  return (
    !!location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.latitude) <= 90 &&
    Math.abs(location.longitude) <= 180 &&
    !(location.latitude === 0 && location.longitude === 0)
  );
}
