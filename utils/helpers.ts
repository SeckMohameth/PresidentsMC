import { Linking, Platform } from 'react-native';
import { Location } from '@/types';

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export function formatMiles(miles: number): string {
  if (miles >= 1000) {
    return `${(miles / 1000).toFixed(1)}k`;
  }
  return miles.toLocaleString();
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toLocaleString();
}

export function getPaceColor(pace: 'casual' | 'moderate' | 'spirited'): string {
  switch (pace) {
    case 'casual': return '#22C55E';
    case 'moderate': return '#FBBF24';
    case 'spirited': return '#EF4444';
    default: return '#9CA3AF';
  }
}

export function getPaceLabel(pace: 'casual' | 'moderate' | 'spirited'): string {
  switch (pace) {
    case 'casual': return 'Casual';
    case 'moderate': return 'Moderate';
    case 'spirited': return 'Spirited';
    default: return pace;
  }
}

export type MapsApp = 'apple' | 'google' | 'waze';

function isValidCoordinate(location?: Pick<Location, 'latitude' | 'longitude'> | null) {
  return !!location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.latitude) <= 90 &&
    Math.abs(location.longitude) <= 180 &&
    !(location.latitude === 0 && location.longitude === 0);
}

function coordinateParam(location: Pick<Location, 'latitude' | 'longitude'>) {
  return `${location.latitude},${location.longitude}`;
}

function encodedLabel(location: Location) {
  return encodeURIComponent(location.name || location.address || coordinateParam(location));
}

async function openWithFallback(primaryUrl: string, fallbackUrl: string) {
  try {
    await Linking.openURL(primaryUrl);
  } catch {
    await Linking.openURL(fallbackUrl);
  }
}

export async function openInMaps(
  destination: Location,
  app: MapsApp = Platform.OS === 'ios' ? 'apple' : 'google',
  origin?: Location
) {
  if (!isValidCoordinate(destination)) {
    throw new Error('INVALID_DESTINATION');
  }

  const hasOrigin = isValidCoordinate(origin);
  const destinationCoord = coordinateParam(destination);
  const originCoord = hasOrigin && origin ? coordinateParam(origin) : '';
  const destinationLabel = encodedLabel(destination);

  const googleWebUrl = hasOrigin
    ? `https://www.google.com/maps/dir/?api=1&origin=${originCoord}&destination=${destinationCoord}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${destinationCoord}&travelmode=driving`;
  const appleWebUrl = hasOrigin
    ? `https://maps.apple.com/?saddr=${originCoord}&daddr=${destinationCoord}&dirflg=d`
    : `https://maps.apple.com/?daddr=${destinationCoord}&q=${destinationLabel}&dirflg=d`;

  if (Platform.OS === 'web') {
    await Linking.openURL(googleWebUrl);
    return;
  }

  switch (app) {
    case 'apple': {
      const appleNativeUrl = hasOrigin
        ? `maps://maps.apple.com/?saddr=${originCoord}&daddr=${destinationCoord}&dirflg=d&t=m`
        : `maps://maps.apple.com/?daddr=${destinationCoord}&q=${destinationLabel}&dirflg=d&t=m`;
      await openWithFallback(appleNativeUrl, appleWebUrl);
      return;
    }
    case 'google': {
      if (Platform.OS === 'android' && !hasOrigin) {
        await openWithFallback(`google.navigation:q=${destinationCoord}&mode=d`, googleWebUrl);
        return;
      }
      const googleNativeUrl = hasOrigin
        ? `comgooglemaps://?saddr=${originCoord}&daddr=${destinationCoord}&directionsmode=driving`
        : `comgooglemaps://?daddr=${destinationCoord}&directionsmode=driving`;
      await openWithFallback(googleNativeUrl, googleWebUrl);
      return;
    }
    case 'waze': {
      await openWithFallback(
        `waze://?ll=${destinationCoord}&navigate=yes`,
        `https://waze.com/ul?ll=${destinationCoord}&navigate=yes`
      );
      return;
    }
  }
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function isUpcoming(dateString: string): boolean {
  return new Date(dateString) > new Date();
}

export function isToday(dateString: string): boolean {
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export function getDaysUntil(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  return Math.ceil(diffMs / 86400000);
}

export function calculateDistanceMiles(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(end.latitude - start.latitude);
  const dLon = toRad(end.longitude - start.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(start.latitude)) *
      Math.cos(toRad(end.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
