import { DynamicColorIOS, Platform, PlatformColor } from 'react-native';

function adaptive(light: string, dark: string, androidAttr?: string): string {
  if (Platform.OS === 'ios') {
    return DynamicColorIOS({ light, dark }) as unknown as string;
  }
  if (Platform.OS === 'android' && androidAttr) {
    return PlatformColor(androidAttr) as unknown as string;
  }
  return dark;
}

const palette = {
  black: '#050505',
  nearBlack: '#111111',
  charcoal: '#1A1A1A',
  white: '#FFFFFF',
  nearWhite: '#F7F7F7',
  silver: '#C0C0C0',
  silverSoft: '#E5E5E5',
  graphite: '#2E2E2E',
  graphiteLight: '#4A4A4A',
  grey: '#8A8A8A',
  greyDark: '#5F5F5F',
  heat: '#D83A2E',
  heatMuted: '#7A1F19',
  blue: '#3B82F6',
  blueMuted: '#1E3A8A',
  amber: '#F07A22',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
};

const light = {
  background: palette.white,
  surface: palette.nearWhite,
  surfaceElevated: palette.silverSoft,
  border: '#D6D6D6',
  borderLight: '#B8B8B8',
  text: palette.black,
  textSecondary: palette.graphite,
  textTertiary: palette.greyDark,
  primary: palette.graphite,
  primaryMuted: palette.greyDark,
  accent: palette.black,
  heat: palette.heat,
  heatMuted: '#B72F25',
  info: '#1D4ED8',
  infoMuted: '#DBEAFE',
  amber: palette.amber,
  success: '#15803D',
  warning: '#B45309',
  error: '#DC2626',
  upcoming: palette.graphite,
  pending: '#B45309',
  completed: '#15803D',
  created: '#15803D',
  deleted: '#DC2626',
  cancelled: '#7F1D1D',
  tint: palette.graphite,
  tabIconDefault: palette.greyDark,
  tabIconSelected: palette.black,
  icon: palette.graphite,
};

const dark = {
  background: adaptive(light.background, palette.black, '?android:attr/colorBackground'),
  surface: adaptive(light.surface, palette.nearBlack, '?android:attr/colorBackground'),
  surfaceElevated: adaptive(light.surfaceElevated, palette.charcoal, '?android:attr/colorBackground'),
  border: adaptive(light.border, palette.graphite),
  borderLight: adaptive(light.borderLight, palette.graphiteLight),
  text: adaptive(light.text, '#F5F5F5', '?android:attr/textColorPrimary'),
  textSecondary: adaptive(light.textSecondary, palette.silver, '?android:attr/textColorSecondary'),
  textTertiary: adaptive(light.textTertiary, palette.grey),
  primary: adaptive(light.primary, palette.silver),
  primaryMuted: adaptive(light.primaryMuted, '#8F8F8F'),
  accent: adaptive(light.accent, palette.silverSoft),
  heat: palette.heat,
  heatMuted: adaptive(light.heatMuted, palette.heatMuted),
  info: adaptive(light.info, palette.blue),
  infoMuted: adaptive(light.infoMuted, palette.blueMuted),
  amber: palette.amber,
  success: adaptive(light.success, palette.success),
  warning: adaptive(light.warning, palette.warning),
  error: adaptive(light.error, palette.error),
  upcoming: adaptive(light.upcoming, palette.silver),
  pending: adaptive(light.pending, palette.warning),
  completed: adaptive(light.completed, palette.success),
  created: adaptive(light.created, palette.success),
  deleted: adaptive(light.deleted, palette.error),
  cancelled: adaptive(light.cancelled, '#991B1B'),
  tint: adaptive(light.tint, palette.silver),
  tabIconDefault: adaptive(light.tabIconDefault, '#777777'),
  tabIconSelected: adaptive(light.tabIconSelected, palette.silver),
  icon: adaptive(light.icon, palette.silver),
};

const Colors = {
  light,
  dark,
  gradients: {
    primary: ['#E5E5E5', '#8F8F8F'],
    heat: ['#1A1A1A', '#7A1F19', '#D83A2E'],
    card: ['#1A1A1A', '#111111'],
    overlay: ['transparent', 'rgba(0,0,0,0.8)'],
  },
};

export default Colors;
