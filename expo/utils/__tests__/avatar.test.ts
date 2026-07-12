import { DEFAULT_AVATAR, getAvatarSource, isDefaultAvatar } from '@/utils/avatar';

describe('isDefaultAvatar', () => {
  it('treats missing values and the sentinel as the default avatar', () => {
    expect(isDefaultAvatar(undefined)).toBe(true);
    expect(isDefaultAvatar(null)).toBe(true);
    expect(isDefaultAvatar('')).toBe(true);
    expect(isDefaultAvatar(DEFAULT_AVATAR)).toBe(true);
  });

  it('treats real URLs as custom avatars', () => {
    expect(isDefaultAvatar('https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg')).toBe(false);
  });
});

describe('getAvatarSource', () => {
  it('returns the bundled helmet asset for default avatars', () => {
    const bundled = getAvatarSource(DEFAULT_AVATAR);
    expect(getAvatarSource(null)).toEqual(bundled);
    expect(getAvatarSource(undefined)).toEqual(bundled);
    expect(bundled).not.toHaveProperty('uri', DEFAULT_AVATAR);
  });

  it('wraps custom avatar URLs in a uri source', () => {
    expect(getAvatarSource('https://example.com/me.jpg')).toEqual({ uri: 'https://example.com/me.jpg' });
  });
});
