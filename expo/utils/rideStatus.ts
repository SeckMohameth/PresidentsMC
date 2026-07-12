import { Ride } from '@/types';

// How long past its scheduled end a ride still counts as "happening" —
// riders arrive late, check in at the meetup point, and post photos.
export const RIDE_ACTIVE_GRACE_MS = 2 * 60 * 60 * 1000;
export const DEFAULT_RIDE_DURATION_MS = 2 * 60 * 60 * 1000;

export function getRideDurationMs(ride: Pick<Ride, 'estimatedDuration' | 'routeDurationSeconds'>): number {
  if (ride.routeDurationSeconds && Number.isFinite(ride.routeDurationSeconds)) {
    return ride.routeDurationSeconds * 1000;
  }
  const match = /([\d.]+)\s*(hour|hr|h|minute|min|m)/i.exec(ride.estimatedDuration || '');
  if (match) {
    const value = parseFloat(match[1]);
    if (Number.isFinite(value) && value > 0) {
      return match[2].toLowerCase().startsWith('h') ? value * 3_600_000 : value * 60_000;
    }
  }
  return DEFAULT_RIDE_DURATION_MS;
}

export function resolveRideStatus(
  ride: Pick<Ride, 'status' | 'dateTime' | 'estimatedDuration' | 'routeDurationSeconds'>
): Ride['status'] {
  if (ride.status !== 'upcoming') return ride.status;
  const rideTime = new Date(ride.dateTime).getTime();
  if (Number.isNaN(rideTime)) return ride.status;
  const now = Date.now();
  if (now < rideTime) return 'upcoming';
  // Once the start time passes, the ride is ACTIVE (not completed) for its
  // duration plus a grace window, so check-in and the ride chat stay open
  // while the crew is actually out riding.
  return now < rideTime + getRideDurationMs(ride) + RIDE_ACTIVE_GRACE_MS ? 'active' : 'completed';
}
