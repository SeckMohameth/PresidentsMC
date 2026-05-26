export const CLUB_ID = process.env.EXPO_PUBLIC_CLUB_ID || 'presidents-mc';
export const CLUB_NAME = process.env.EXPO_PUBLIC_CLUB_NAME || 'PresidentsMC';
export const CLUB_DESCRIPTION =
  process.env.EXPO_PUBLIC_CLUB_DESCRIPTION ||
  'Private biker club rides, announcements, members, photos, and stats.';

export const OWNER_EMAILS = (process.env.EXPO_PUBLIC_OWNER_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const DEVELOPER_ADMIN_EMAILS = (
  process.env.EXPO_PUBLIC_DEVELOPER_ADMIN_EMAILS || ''
)
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isInitialOwnerEmail(email?: string | null) {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.trim().toLowerCase());
}

export function isDeveloperAdminEmail(email?: string | null) {
  if (!email) return false;
  return DEVELOPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
