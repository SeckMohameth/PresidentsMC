import { Image as RNImage, ImageSourcePropType } from 'react-native';

export type CoverImagePreset = {
  id: string;
  label: string;
  source: ImageSourcePropType;
};

export const COVER_IMAGE_PRESETS: CoverImagePreset[] = [
  {
    id: 'jan-kopriva-aby36io-q48',
    label: 'Night Ride',
    source: require('../assets/images/custom-images/optimized/night-ride.jpg'),
  },
  {
    id: 'harley-davidson-aibyhrzsqw4',
    label: 'Harley',
    source: require('../assets/images/custom-images/optimized/harley.jpg'),
  },
  {
    id: 'danny-greenberg-kjtwyzs42ba',
    label: 'Garage',
    source: require('../assets/images/custom-images/optimized/garage.jpg'),
  },
  {
    id: 'jan-kopriva-4ya6dpfnil4',
    label: 'Open Road',
    source: require('../assets/images/custom-images/optimized/open-road.jpg'),
  },
  {
    id: 'maxim-simonov-gk9msojdceg',
    label: 'Cruise',
    source: require('../assets/images/custom-images/optimized/cruise.jpg'),
  },
  {
    id: 'ralph-katieb-8xw-eztlje4',
    label: 'Lineup',
    source: require('../assets/images/custom-images/optimized/lineup.jpg'),
  },
  {
    id: 'red-shuheart-ydy-lrieqbo',
    label: 'Roadside',
    source: require('../assets/images/custom-images/optimized/roadside.jpg'),
  },
  {
    id: 'unknown-unnamed-dxc7d1jxlpi',
    label: 'Meetup',
    source: require('../assets/images/custom-images/optimized/meetup.jpg'),
  },
];

export const DEFAULT_RIDE_COVER_PRESET_ID = 'jan-kopriva-aby36io-q48';

export function getCoverPresetUri(preset: CoverImagePreset) {
  return RNImage.resolveAssetSource(preset.source).uri;
}

export function getDefaultRideCoverUri() {
  const preset = COVER_IMAGE_PRESETS.find((item) => item.id === DEFAULT_RIDE_COVER_PRESET_ID);
  return preset ? getCoverPresetUri(preset) : '';
}
