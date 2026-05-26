# Crew: Bike Clubs & Rides

Crew is a React Native app for private bike and motorcycle clubs to organize rides, manage members, post announcements, share ride photos, and track activity.

## Stack

- Expo Router
- React Native
- Firebase Auth, Firestore, Storage, Functions
- RevenueCat for subscriptions

## Local development

From the repo root:

```bash
bun run start
```

From the Expo app directly:

```bash
cd expo
bun run start
```

Additional commands:

```bash
bun run start-web
bun run lint
./node_modules/.bin/tsc --noEmit
```

## Firebase

This project uses:

- Firestore rules in `firestore.rules`
- Storage rules in `storage.rules`
- Cloud Functions in `functions/src/index.ts`

Deploy from `expo/`:

```bash
firebase deploy --only functions --project crew-86290
firebase deploy --only firestore:indexes --project crew-86290
```

## Release notes

- iOS bundle ID: `app.mostudios.crewapp`
- Android package: `app.mostudios.crewapp`
- RevenueCat entitlement: `crew_admin`
- RevenueCat packages: `$rc_monthly` and `$rc_annual`

## Testing notes

- Real purchases require a development build or TestFlight.
- Push notifications require a physical device and a development build or release build.
- Account deletion, ownership transfer, invite-code joins, and subscription sync depend on deployed Firebase Functions.
- For tester-only paywall bypass builds, use the `testflight` EAS profile. It sets `EXPO_PUBLIC_TESTFLIGHT_CREW_ADMIN_BYPASS=true` so users can continue from the crew paywall without billing.
