// Maps raw Firebase/network errors to messages that tell the user WHY the
// action failed and what to do about it, instead of a generic "try again".

function readCode(error: unknown): string {
  const err = error as { code?: unknown } | null | undefined;
  return String(err?.code ?? '').toLowerCase();
}

function readMessage(error: unknown): string {
  const err = error as { message?: unknown } | null | undefined;
  return String(err?.message ?? '');
}

export function getFriendlyErrorMessage(error: unknown, fallback: string): string {
  const code = readCode(error);
  const message = readMessage(error);

  if (message.includes('SUBSCRIPTION_INACTIVE')) {
    return "The club's subscription is inactive, so this feature is paused. A club admin needs to renew it under More → Subscription.";
  }
  if (message.includes('NOT_AUTHORIZED')) {
    return "You don't have permission to do this. Ask a club admin or officer for access.";
  }
  if (code.includes('permission-denied')) {
    return "You don't have permission to do this right now. If the club's subscription lapsed, a club admin needs to renew it under More → Subscription.";
  }
  if (code.includes('unauthenticated') || code.includes('requires-recent-login')) {
    return 'Your session expired. Sign out, sign back in, and try again.';
  }
  if (
    code.includes('unavailable') ||
    code.includes('network-request-failed') ||
    code.includes('deadline-exceeded') ||
    message.includes('timed out') ||
    message.toLowerCase().includes('network')
  ) {
    return 'Could not reach the server. Check your internet connection and try again.';
  }
  if (code.includes('resource-exhausted') || code.includes('too-many-requests')) {
    return 'Too many attempts right now. Wait a moment and try again.';
  }
  if (code.startsWith('functions/') && code.includes('not-found')) {
    return 'This feature is temporarily unavailable. Please try again later or update the app.';
  }
  return fallback;
}

// Sign-in specific mapping: never blame the password for a network problem.
export function getSignInErrorMessage(error: unknown): string {
  const code = readCode(error);
  if (code.includes('network-request-failed')) {
    return 'Could not reach the server. Check your internet connection and try again.';
  }
  if (code.includes('too-many-requests')) {
    return 'Too many sign-in attempts. Wait a few minutes, or reset your password.';
  }
  if (code.includes('user-disabled')) {
    return 'This account has been disabled. Contact the club admin for help.';
  }
  if (
    code.includes('invalid-credential') ||
    code.includes('wrong-password') ||
    code.includes('user-not-found') ||
    code.includes('invalid-email')
  ) {
    return 'Invalid email or password. Please try again.';
  }
  return 'Could not sign you in right now. Please try again in a moment.';
}
