import { getFriendlyErrorMessage, getSignInErrorMessage } from '@/utils/errorMessages';

const FALLBACK = 'Could not do the thing.';

describe('getFriendlyErrorMessage', () => {
  it('explains an inactive club subscription', () => {
    const message = getFriendlyErrorMessage(new Error('SUBSCRIPTION_INACTIVE'), FALLBACK);
    expect(message).toContain('subscription is inactive');
    expect(message).toContain('More → Subscription');
  });

  it('explains missing authorization from app-level errors', () => {
    expect(getFriendlyErrorMessage(new Error('NOT_AUTHORIZED'), FALLBACK)).toContain(
      "don't have permission"
    );
  });

  it('maps Firestore permission-denied to a permission message that mentions the subscription', () => {
    const message = getFriendlyErrorMessage({ code: 'permission-denied' }, FALLBACK);
    expect(message).toContain("don't have permission");
    expect(message).toContain('More → Subscription');
  });

  it('handles namespaced firestore codes', () => {
    expect(getFriendlyErrorMessage({ code: 'firestore/permission-denied' }, FALLBACK)).toContain(
      "don't have permission"
    );
  });

  it('prioritizes the specific SUBSCRIPTION_INACTIVE reason over a generic code', () => {
    const error = { code: 'permission-denied', message: 'SUBSCRIPTION_INACTIVE' };
    expect(getFriendlyErrorMessage(error, FALLBACK)).toContain('subscription is inactive');
  });

  it.each(['unauthenticated', 'auth/requires-recent-login'])(
    'tells the user to re-sign-in for %s',
    (code) => {
      expect(getFriendlyErrorMessage({ code }, FALLBACK)).toContain('session expired');
    }
  );

  it.each([
    [{ code: 'unavailable' }],
    [{ code: 'auth/network-request-failed' }],
    [{ code: 'deadline-exceeded' }],
    [{ message: 'Image upload timed out. Please try again.' }],
    [{ message: 'Network request failed' }],
  ])('maps connectivity failures to a network message: %j', (error) => {
    expect(getFriendlyErrorMessage(error, FALLBACK)).toContain('internet connection');
  });

  it.each([[{ code: 'resource-exhausted' }], [{ code: 'auth/too-many-requests' }]])(
    'maps throttling to a wait message: %j',
    (error) => {
      expect(getFriendlyErrorMessage(error, FALLBACK)).toContain('Too many attempts');
    }
  );

  it('flags missing cloud functions as temporarily unavailable', () => {
    expect(getFriendlyErrorMessage({ code: 'functions/not-found' }, FALLBACK)).toContain(
      'temporarily unavailable'
    );
  });

  it('returns the fallback for unknown errors and non-error values', () => {
    expect(getFriendlyErrorMessage(new Error('kaboom'), FALLBACK)).toBe(FALLBACK);
    expect(getFriendlyErrorMessage({ code: 'weird/unknown' }, FALLBACK)).toBe(FALLBACK);
    expect(getFriendlyErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(getFriendlyErrorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(getFriendlyErrorMessage('string error', FALLBACK)).toBe(FALLBACK);
  });
});

describe('getSignInErrorMessage', () => {
  it('never blames the password for a network problem', () => {
    expect(getSignInErrorMessage({ code: 'auth/network-request-failed' })).toContain(
      'internet connection'
    );
  });

  it('maps throttled sign-ins to a wait/reset message', () => {
    expect(getSignInErrorMessage({ code: 'auth/too-many-requests' })).toContain('Wait a few minutes');
  });

  it('maps disabled accounts to a contact-admin message', () => {
    expect(getSignInErrorMessage({ code: 'auth/user-disabled' })).toContain('disabled');
  });

  it.each([
    'auth/invalid-credential',
    'auth/wrong-password',
    'auth/user-not-found',
    'auth/invalid-email',
  ])('maps %s to invalid email or password', (code) => {
    expect(getSignInErrorMessage({ code })).toBe('Invalid email or password. Please try again.');
  });

  it('uses a generic retry message for anything else', () => {
    expect(getSignInErrorMessage(new Error('boom'))).toContain('try again in a moment');
    expect(getSignInErrorMessage(undefined)).toContain('try again in a moment');
  });
});
