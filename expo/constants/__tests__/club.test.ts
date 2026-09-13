import { CLUB_NAME, getClubDisplayName } from '@/constants/club';

describe('getClubDisplayName', () => {
  it.each(['PresidentsMC', 'Presidents MC', 'presidents-mc', 'PMC'])(
    'replaces the legacy club name %s',
    (legacyName) => {
      expect(getClubDisplayName(legacyName)).toBe(CLUB_NAME);
    }
  );

  it('preserves a genuinely customized club name', () => {
    expect(getClubDisplayName('Wheels of Soul Baltimore')).toBe('Wheels of Soul Baltimore');
  });

  it('uses the branded default when no name is stored', () => {
    expect(getClubDisplayName('')).toBe(CLUB_NAME);
  });
});
