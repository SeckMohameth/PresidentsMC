import { Crew, CrewMember } from '@/types';

export type CrewAccessMember = Pick<CrewMember, 'id' | 'role' | 'permissions' | 'isDeveloperSupport'>;
export type CrewAccessCrew = Pick<
  Crew,
  'ownerId' | 'subscriptionOwnerId' | 'subscriptionStatus' | 'billingRequired'
>;

export interface CrewAccess {
  isAdmin: boolean;
  isOfficer: boolean;
  isDeveloperSupport: boolean;
  isOwner: boolean;
  subscriptionOwnerIsBillable: boolean;
  isSubscriptionActive: boolean;
  isBillingRequired: boolean;
  canUseAdminTools: boolean;
  hasPaidFeatureAccess: boolean;
  canManageRides: boolean;
  canManageAnnouncements: boolean;
  canManageAlbums: boolean;
  canManageJoinRequests: boolean;
  canPost: boolean;
}

// Single source of truth for who may do what in a club, mirroring what
// firestore.rules enforces server-side. Paid gating: ride/album management
// pauses when billing is required and the subscription lapsed; announcements,
// join requests, RSVPs, and chat stay available (safety features).
export function deriveCrewAccess(
  currentUser: CrewAccessMember | null,
  crew: CrewAccessCrew | null,
  allMembers: Pick<CrewAccessMember, 'id' | 'isDeveloperSupport'>[]
): CrewAccess {
  const isAdmin = currentUser?.role === 'admin';
  const isOfficer = currentUser?.role === 'officer';
  const isDeveloperSupport = !!currentUser?.isDeveloperSupport;
  const isOwner = !!currentUser?.id && crew?.ownerId === currentUser.id;
  const permissions = currentUser?.permissions || {};
  // A subscription only counts if its owner is still a billable member —
  // otherwise a departed (or developer-support) owner would keep a club "paid".
  const subscriptionOwnerIsBillable = !!crew?.subscriptionOwnerId && allMembers.some(
    (member) => member.id === crew.subscriptionOwnerId && !member.isDeveloperSupport
  );
  const isSubscriptionActive = subscriptionOwnerIsBillable && (
    crew?.subscriptionStatus === 'active' || crew?.subscriptionStatus === 'trialing'
  );
  const isBillingRequired = crew?.billingRequired === true;
  const canUseAdminTools = isAdmin || isOfficer || isDeveloperSupport;
  const hasPaidFeatureAccess = !isBillingRequired || isSubscriptionActive;
  const canManageRides =
    isDeveloperSupport || ((isAdmin || isOfficer || permissions.manageRides === true) && hasPaidFeatureAccess);
  const canManageAnnouncements =
    isDeveloperSupport || isAdmin || isOfficer || permissions.manageAnnouncements === true;
  const canManageAlbums =
    isDeveloperSupport || ((isAdmin || isOfficer || permissions.manageAlbums === true) && hasPaidFeatureAccess);
  const canManageJoinRequests =
    isDeveloperSupport || isAdmin || isOfficer || permissions.manageJoinRequests === true;
  const canPost = canManageRides || canManageAnnouncements;

  return {
    isAdmin,
    isOfficer,
    isDeveloperSupport,
    isOwner,
    subscriptionOwnerIsBillable,
    isSubscriptionActive,
    isBillingRequired,
    canUseAdminTools,
    hasPaidFeatureAccess,
    canManageRides,
    canManageAnnouncements,
    canManageAlbums,
    canManageJoinRequests,
    canPost,
  };
}

// Admin/officer actions that write paid content throw SUBSCRIPTION_INACTIVE
// when the club's billing lapsed. The owner and developer support always pass:
// the owner must reach the subscription screen to fix billing.
export function assertAdminActiveAccess(access: Pick<
  CrewAccess,
  'isDeveloperSupport' | 'isOwner' | 'isBillingRequired' | 'isSubscriptionActive'
>): void {
  if (access.isDeveloperSupport) return;
  if (access.isOwner) return;
  if (access.isBillingRequired && !access.isSubscriptionActive) {
    throw new Error('SUBSCRIPTION_INACTIVE');
  }
}
