import { assertAdminActiveAccess, deriveCrewAccess, CrewAccessCrew, CrewAccessMember } from '@/utils/crewAccess';

const member = (overrides: Partial<CrewAccessMember> = {}): CrewAccessMember => ({
  id: 'user-1',
  role: 'member',
  permissions: {},
  isDeveloperSupport: false,
  ...overrides,
});

const crew = (overrides: Partial<CrewAccessCrew> = {}): CrewAccessCrew => ({
  ownerId: 'owner-1',
  subscriptionOwnerId: 'owner-1',
  subscriptionStatus: 'active',
  billingRequired: true,
  ...overrides,
});

// The subscription owner present as a normal, billable member.
const billableRoster = [{ id: 'owner-1', isDeveloperSupport: false }, { id: 'user-1' }];

describe('deriveCrewAccess — roles', () => {
  it('grants a plain member nothing management-related', () => {
    const access = deriveCrewAccess(member(), crew(), billableRoster);
    expect(access.canUseAdminTools).toBe(false);
    expect(access.canManageRides).toBe(false);
    expect(access.canManageAnnouncements).toBe(false);
    expect(access.canManageAlbums).toBe(false);
    expect(access.canManageJoinRequests).toBe(false);
    expect(access.canPost).toBe(false);
  });

  it('grants an admin full management on a paid crew', () => {
    const access = deriveCrewAccess(member({ role: 'admin' }), crew(), billableRoster);
    expect(access.isAdmin).toBe(true);
    expect(access.canUseAdminTools).toBe(true);
    expect(access.canManageRides).toBe(true);
    expect(access.canManageAnnouncements).toBe(true);
    expect(access.canManageAlbums).toBe(true);
    expect(access.canManageJoinRequests).toBe(true);
    expect(access.canPost).toBe(true);
  });

  it('grants an officer the same management surface as an admin', () => {
    const access = deriveCrewAccess(member({ role: 'officer' }), crew(), billableRoster);
    expect(access.isOfficer).toBe(true);
    expect(access.canManageRides).toBe(true);
    expect(access.canManageAnnouncements).toBe(true);
    expect(access.canManageAlbums).toBe(true);
    expect(access.canManageJoinRequests).toBe(true);
  });

  it('detects the crew owner', () => {
    expect(deriveCrewAccess(member({ id: 'owner-1', role: 'admin' }), crew(), billableRoster).isOwner).toBe(true);
    expect(deriveCrewAccess(member({ role: 'admin' }), crew(), billableRoster).isOwner).toBe(false);
  });

  it('handles a signed-out or crew-less state without blowing up', () => {
    const access = deriveCrewAccess(null, null, []);
    expect(access.canUseAdminTools).toBe(false);
    expect(access.canPost).toBe(false);
    expect(access.isOwner).toBe(false);
    // No crew ⇒ no billing requirement ⇒ paid features are not artificially locked.
    expect(access.hasPaidFeatureAccess).toBe(true);
  });
});

describe('deriveCrewAccess — granular member permissions', () => {
  it('lets a delegated member manage exactly what they were granted', () => {
    const access = deriveCrewAccess(
      member({ permissions: { manageRides: true, manageJoinRequests: true } }),
      crew(),
      billableRoster
    );
    expect(access.canManageRides).toBe(true);
    expect(access.canManageJoinRequests).toBe(true);
    expect(access.canManageAnnouncements).toBe(false);
    expect(access.canManageAlbums).toBe(false);
    // Delegated permissions do NOT unlock the admin tools area.
    expect(access.canUseAdminTools).toBe(false);
  });

  it('canPost follows either ride or announcement management', () => {
    expect(deriveCrewAccess(member({ permissions: { manageAnnouncements: true } }), crew(), billableRoster).canPost).toBe(true);
    expect(deriveCrewAccess(member({ permissions: { manageRides: true } }), crew(), billableRoster).canPost).toBe(true);
    expect(deriveCrewAccess(member({ permissions: { manageAlbums: true } }), crew(), billableRoster).canPost).toBe(false);
  });
});

describe('deriveCrewAccess — subscription gating', () => {
  const lapsed = crew({ subscriptionStatus: 'inactive' });

  it('pauses paid management (rides, albums) when billing is required and the subscription lapsed', () => {
    const access = deriveCrewAccess(member({ role: 'admin' }), lapsed, billableRoster);
    expect(access.hasPaidFeatureAccess).toBe(false);
    expect(access.canManageRides).toBe(false);
    expect(access.canManageAlbums).toBe(false);
  });

  it('keeps safety/communication management available on a lapsed crew', () => {
    const access = deriveCrewAccess(member({ role: 'admin' }), lapsed, billableRoster);
    expect(access.canManageAnnouncements).toBe(true);
    expect(access.canManageJoinRequests).toBe(true);
    expect(access.canUseAdminTools).toBe(true);
    expect(access.canPost).toBe(true);
  });

  it('paid gating also applies to delegated member permissions', () => {
    const access = deriveCrewAccess(member({ permissions: { manageRides: true, manageAlbums: true } }), lapsed, billableRoster);
    expect(access.canManageRides).toBe(false);
    expect(access.canManageAlbums).toBe(false);
  });

  it('treats a trialing subscription as active', () => {
    const access = deriveCrewAccess(member({ role: 'admin' }), crew({ subscriptionStatus: 'trialing' }), billableRoster);
    expect(access.isSubscriptionActive).toBe(true);
    expect(access.canManageRides).toBe(true);
  });

  it('treats past_due as NOT active', () => {
    const access = deriveCrewAccess(member({ role: 'admin' }), crew({ subscriptionStatus: 'past_due' }), billableRoster);
    expect(access.isSubscriptionActive).toBe(false);
    expect(access.canManageRides).toBe(false);
  });

  it('ignores billing entirely when the crew does not require it', () => {
    const free = crew({ billingRequired: false, subscriptionStatus: 'inactive' });
    const access = deriveCrewAccess(member({ role: 'admin' }), free, billableRoster);
    expect(access.hasPaidFeatureAccess).toBe(true);
    expect(access.canManageRides).toBe(true);
    expect(access.canManageAlbums).toBe(true);
  });

  it("does not count a subscription whose owner left the club", () => {
    const rosterWithoutOwner = [{ id: 'user-1' }];
    const access = deriveCrewAccess(member({ role: 'admin' }), crew(), rosterWithoutOwner);
    expect(access.subscriptionOwnerIsBillable).toBe(false);
    expect(access.isSubscriptionActive).toBe(false);
    expect(access.canManageRides).toBe(false);
  });

  it('does not count a developer-support account as a billable subscription owner', () => {
    const devRoster = [{ id: 'owner-1', isDeveloperSupport: true }, { id: 'user-1' }];
    const access = deriveCrewAccess(member({ role: 'admin' }), crew(), devRoster);
    expect(access.subscriptionOwnerIsBillable).toBe(false);
    expect(access.isSubscriptionActive).toBe(false);
  });

  it('requires a subscriptionOwnerId for the subscription to count at all', () => {
    const access = deriveCrewAccess(member({ role: 'admin' }), crew({ subscriptionOwnerId: null }), billableRoster);
    expect(access.isSubscriptionActive).toBe(false);
  });
});

describe('deriveCrewAccess — developer support bypass', () => {
  it('unlocks all management even on a lapsed crew, without touching billing flags', () => {
    const access = deriveCrewAccess(
      member({ isDeveloperSupport: true }),
      crew({ subscriptionStatus: 'inactive' }),
      billableRoster
    );
    expect(access.isDeveloperSupport).toBe(true);
    expect(access.canUseAdminTools).toBe(true);
    expect(access.canManageRides).toBe(true);
    expect(access.canManageAnnouncements).toBe(true);
    expect(access.canManageAlbums).toBe(true);
    expect(access.canManageJoinRequests).toBe(true);
    expect(access.hasPaidFeatureAccess).toBe(false); // billing truth is preserved
  });
});

describe('assertAdminActiveAccess', () => {
  const base = { isDeveloperSupport: false, isOwner: false, isBillingRequired: true, isSubscriptionActive: false };

  it('throws SUBSCRIPTION_INACTIVE for a non-owner admin on a lapsed, billed crew', () => {
    expect(() => assertAdminActiveAccess(base)).toThrow('SUBSCRIPTION_INACTIVE');
  });

  it('always lets the owner through so they can reach the subscription screen', () => {
    expect(() => assertAdminActiveAccess({ ...base, isOwner: true })).not.toThrow();
  });

  it('always lets developer support through', () => {
    expect(() => assertAdminActiveAccess({ ...base, isDeveloperSupport: true })).not.toThrow();
  });

  it('passes when billing is not required or the subscription is active', () => {
    expect(() => assertAdminActiveAccess({ ...base, isBillingRequired: false })).not.toThrow();
    expect(() => assertAdminActiveAccess({ ...base, isSubscriptionActive: true })).not.toThrow();
  });
});
