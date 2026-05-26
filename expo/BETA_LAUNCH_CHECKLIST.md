# Crew Beta Launch Checklist

## Firebase
- [ ] Deploy `firestore.rules`, `storage.rules`, and `firestore.indexes.json`.
- [ ] Run the rules suite locally with `npm run test:rules`.
- [ ] Configure Firebase Auth email verification template text.
- [ ] Configure Firebase Auth password-reset template text.
- [ ] Set Auth action URLs and authorized domains for iOS, Android, and web fallbacks.
- [ ] Set the support inbox you want verification and reset flows to reference.
- [ ] Keep email verification soft for beta, but verify the reminder and resend flow on device.

## RevenueCat
- [ ] Create the `crew_admin` entitlement.
- [ ] Create monthly and yearly products in App Store Connect and Play Console.
- [ ] Create an offering that maps both products to `crew_admin`.
- [ ] Set the Firebase function secret with `firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET`.
- [ ] Point the RevenueCat webhook to the deployed `revenueCatWebhook` function.
- [ ] Confirm webhook events update `crews.subscriptionStatus` and `crews.subscriptionOwnerId`.
- [ ] Verify the owner-leave flow locks admin tools until a new owner subscribes.
- [ ] Test the "Manage Subscription" deep link on iOS and Android.

## Apple
- [ ] Enroll in the Apple Developer Program.
- [ ] Create the app in App Store Connect.
- [ ] Register the production bundle identifier.
- [ ] Configure auto-renewable subscriptions and pricing.
- [ ] Add sandbox testers for subscription QA.
- [ ] Prepare App Store privacy answers, support URL, and account deletion disclosure.
- [ ] Add Sign in with Apple capability for the app ID, but keep implementation post-beta unless you decide to pull it in sooner.

## Google
- [ ] Create the app in Google Play Console.
- [ ] Register the Android package name used by release builds.
- [ ] Configure subscriptions and license testers.
- [ ] Prepare the Play data safety form and support URL.
- [ ] Set up Google Sign-In client IDs in Firebase for post-beta rollout.

## QA
- [ ] Test invite-code join, discoverable join request, and join approval/denial.
- [ ] Test owner leave with an officer available.
- [ ] Test owner leave with only members available.
- [ ] Test last-member leave and confirm archive metadata is written.
- [ ] Test delete-account anonymization on announcements, rides, and ride photos.
- [ ] Test push notifications for join requests and join-request decisions.
- [ ] Test Unsplash search through the deployed callable function.
- [ ] Test password reset and verification emails on real inboxes.
- [ ] Test subscription purchase, renewal, expiration, billing issue, and owner handoff states.

## Social Auth
- [ ] Decide whether Apple and Google sign-in stay post-beta or move into beta.
- [ ] If enabled, configure Firebase providers plus Expo native settings for Apple Sign-In.
- [ ] If enabled, configure Firebase providers plus Expo native settings for Google Sign-In.
- [ ] Decide whether social auth accounts must link back to the same Crew account or remain standalone.

## Legal and Launch
- [ ] Publish privacy policy and terms links in the app and store listings.
- [ ] Add support email and website links everywhere the stores require them.
- [ ] Confirm subscription disclosure copy matches Apple and Google billing rules.
- [ ] Confirm account deletion behavior in the privacy policy and in-app copy matches the implemented backend.
