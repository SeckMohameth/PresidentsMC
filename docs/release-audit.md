# PresidentsMC Release Audit

Last audited: 2026-05-23

## Store Policy Status

- Account creation has an in-app account deletion path from both the waiting room and the signed-in account screen.
- Privacy Policy and Terms links are exposed from Help & Support and should point to public, non-PDF web pages before submission.
- Feedback and bug reports are linked in-app through `https://www.momadeit.online/apps/pjs8MBE7YCvnzUzLCIFd`.
- RevenueCat and paid subscriptions are disabled for this release. Set `EXPO_PUBLIC_ENABLE_REVENUECAT=true` only after App Store Connect, Play Console products, RevenueCat entitlements, webhooks, and subscription disclosures are ready.
- The production-visible subscription management UI is removed while billing is disabled.
- Push notifications are opt-in and require `EXPO_PUBLIC_EAS_PROJECT_ID` for Expo push tokens.
- Location, photo library, and camera permissions are requested in-context and have iOS purpose strings in `app.json`.
- Firebase Storage rules do not use cross-service Firestore calls. Image uploads should go through the shared upload helper so Storage receives explicit `image/*` metadata.

## Current Technical Checks

- `app.json` has production bundle identifiers: `app.mostudios.presidentsmc` for iOS and Android.
- Photo library, camera, location, notifications, maps, account deletion, privacy, terms, and support surfaces are present in the app.
- Image uploads are expected in these flows: user avatar, bike photo, onboarding avatar, club logo, ride cover, announcement image, album cover, and ride/album photos.
- Rides are saved under `crews/presidents-mc/rides/{rideId}` in Firestore.

## Required Before Submission

- Add the real EAS project id to `EXPO_PUBLIC_EAS_PROJECT_ID`.
- Confirm `https://www.mostudios.io/privacy` names either the app or the developer entity used on the store listing and describes account/data deletion.
- Add an external web account deletion request URL in Google Play Console. Google requires an in-app deletion path and an outside-the-app web resource for apps with account creation.
- Complete Apple App Privacy and Google Play Data Safety forms for Firebase Auth, Firestore user profile data, photos, location/check-in data, analytics events, push tokens, and any third-party SDK data handling.
- Use restricted production Firebase, Google Maps/Places, and EAS credentials. Do not submit with demo or placeholder env values.
- Rebuild the custom Expo dev client after native dependency changes. `expo-document-picker` is native and will not exist in an old dev client until rebuilt.

## References

- Apple account deletion requirement: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Google Play account deletion requirement: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
