import { Image as RNImage, ImageSourcePropType } from 'react-native';

export type CoverImagePreset = {
  id: string;
  label: string;
  fileName: string;
  source: ImageSourcePropType;
};

export const COVER_IMAGE_PRESETS: CoverImagePreset[] = [
  {
    id: 'jan-kopriva-aby36io-q48',
    label: 'Night Ride',
    fileName: 'night-ride.jpg',
    source: require('../assets/images/custom-images/optimized/night-ride.jpg'),
  },
  {
    id: 'harley-davidson-aibyhrzsqw4',
    label: 'Harley',
    fileName: 'harley.jpg',
    source: require('../assets/images/custom-images/optimized/harley.jpg'),
  },
  {
    id: 'danny-greenberg-kjtwyzs42ba',
    label: 'Garage',
    fileName: 'garage.jpg',
    source: require('../assets/images/custom-images/optimized/garage.jpg'),
  },
  {
    id: 'jan-kopriva-4ya6dpfnil4',
    label: 'Open Road',
    fileName: 'open-road.jpg',
    source: require('../assets/images/custom-images/optimized/open-road.jpg'),
  },
  {
    id: 'maxim-simonov-gk9msojdceg',
    label: 'Cruise',
    fileName: 'cruise.jpg',
    source: require('../assets/images/custom-images/optimized/cruise.jpg'),
  },
  {
    id: 'ralph-katieb-8xw-eztlje4',
    label: 'Lineup',
    fileName: 'lineup.jpg',
    source: require('../assets/images/custom-images/optimized/lineup.jpg'),
  },
  {
    id: 'red-shuheart-ydy-lrieqbo',
    label: 'Roadside',
    fileName: 'roadside.jpg',
    source: require('../assets/images/custom-images/optimized/roadside.jpg'),
  },
  {
    id: 'unknown-unnamed-dxc7d1jxlpi',
    label: 'Meetup',
    fileName: 'meetup.jpg',
    source: require('../assets/images/custom-images/optimized/meetup.jpg'),
  },
  {
    id: 'almani-axtykemjih4',
    label: 'Deluxe',
    fileName: 'deluxe.jpg',
    source: require('../assets/images/custom-images/optimized/deluxe.jpg'),
  },
  {
    id: 'gijs-coolen-crmcbeinxtg',
    label: 'Rider POV',
    fileName: 'rider-pov.jpg',
    source: require('../assets/images/custom-images/optimized/rider-pov.jpg'),
  },
  {
    id: 'harley-davidson-1hzcjjdtc9g',
    label: 'Sunset',
    fileName: 'sunset.jpg',
    source: require('../assets/images/custom-images/optimized/sunset.jpg'),
  },
  {
    id: 'harley-davidson-qd6gvrdfpaa',
    label: 'Pack',
    fileName: 'pack.jpg',
    source: require('../assets/images/custom-images/optimized/pack.jpg'),
  },
  {
    id: 'jan-kopriva-c2cw2tssvrc',
    label: 'Ducati',
    fileName: 'ducati.jpg',
    source: require('../assets/images/custom-images/optimized/ducati.jpg'),
  },
];

export const DEFAULT_RIDE_COVER_PRESET_ID = 'jan-kopriva-aby36io-q48';
export const COVER_IMAGE_PRESET_URI_PREFIX = 'preset://cover/';

export function getCoverPresetUri(preset: CoverImagePreset) {
  return RNImage.resolveAssetSource(preset.source).uri;
}

export function getCoverPresetReference(preset: CoverImagePreset) {
  return `${COVER_IMAGE_PRESET_URI_PREFIX}${preset.id}`;
}

export function isCoverPresetReference(uri?: string | null) {
  return !!uri && uri.startsWith(COVER_IMAGE_PRESET_URI_PREFIX);
}

export function getCoverPresetByReference(uri?: string | null) {
  if (!isCoverPresetReference(uri)) return null;
  if (!uri) return null;
  const id = uri.slice(COVER_IMAGE_PRESET_URI_PREFIX.length);
  return COVER_IMAGE_PRESETS.find((item) => item.id === id) ?? null;
}

export function getCoverPresetByAssetUri(uri?: string | null) {
  if (!uri) return null;
  const normalizedUri = decodeURIComponent(uri);
  return COVER_IMAGE_PRESETS.find((preset) => {
    const resolvedUri = getCoverPresetUri(preset);
    return normalizedUri === resolvedUri || normalizedUri.includes(preset.fileName);
  }) ?? null;
}

export function normalizeCoverImageReference(uri?: string | null) {
  if (!uri) return uri ?? '';
  if (isCoverPresetReference(uri)) return uri;
  const preset = getCoverPresetByAssetUri(uri);
  return preset ? getCoverPresetReference(preset) : uri;
}

export function getCoverImageSource(uri?: string | null) {
  const preset = getCoverPresetByReference(uri) ?? getCoverPresetByAssetUri(uri);
  if (preset) return preset.source;
  return uri ? { uri } : undefined;
}

export function getDefaultRideCoverUri() {
  const preset = COVER_IMAGE_PRESETS.find((item) => item.id === DEFAULT_RIDE_COVER_PRESET_ID);
  return preset ? getCoverPresetReference(preset) : '';
}
