import { ImageSourcePropType } from 'react-native';

export const DEFAULT_AVATAR = 'presidentsmc://default-avatar/helmet';

const DEFAULT_AVATAR_SOURCE = require('../assets/images/helmet.jpg') as ImageSourcePropType;

export function isDefaultAvatar(avatar?: string | null) {
  return !avatar || avatar === DEFAULT_AVATAR;
}

export function getAvatarSource(avatar?: string | null): ImageSourcePropType {
  if (isDefaultAvatar(avatar)) return DEFAULT_AVATAR_SOURCE;
  return { uri: avatar as string };
}
