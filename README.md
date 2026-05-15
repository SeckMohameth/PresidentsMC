# PresidentsMC

PresidentsMC is a private mobile app for a biker club based in Connecticut. I built it as a focused, single-club version of a broader app idea I had called Crew, which was originally designed to support many riding clubs. For this project I intentionally narrowed the scope: one club, one branded experience, free members, and paid admin access to help cover hosting and maintenance.

The app was vibe coded with Codex and then shaped around a real client use case: a private club that needs simple tools for announcements, rides, members, photos, and stats without using a noisy social network.

## Why This Exists

The original idea was a multi-club SaaS product where any bike or motorcycle club could create a space, invite members, and manage rides. For this build, the goal changed:

- Build one polished app for one biker club.
- Keep members free.
- Let the club owner/admin pay a small subscription for admin tools.
- Use the project as a real portfolio piece with production-style auth, database rules, file storage, functions, subscriptions, and mobile UI.

## Features

- Email/password sign up and sign in
- Private access request flow
- Owner/admin approval for members
- Member profiles with profile image upload
- Announcements with optional images and links
- Ride planning with start/end locations
- Native map display through `react-native-maps`
- Address geocoding through Expo Location
- Ride RSVPs and check-ins
- Shared ride photo albums
- Club/member stats
- Admin settings, roles, and member management
- RevenueCat-ready admin subscription flow
- Firebase Functions scaffold for invites, cleanup, analytics, notifications, subscriptions, and stats

## Access Model

Members do not pay. They create an account, request access, and wait for approval.

The initial owner is bootstrapped from:

```bash
EXPO_PUBLIC_OWNER_EMAILS=owner@example.com
```

That owner/admin can approve members and manage club content. Admin tools are designed to be gated by subscription status, while basic member access remains free.

## Monetization

This was built as a favor-style project, not a big SaaS launch. The monetization idea is intentionally lightweight:

- Members: free
- Club owner/admin: low subscription
- Example pricing: `$1.99/month` or `$19.99/year`

The subscription is meant to help cover hosting, app upkeep, Firebase usage, App Store/Play Store maintenance, and ongoing support.

## Tech Stack

- Expo
- React Native
- Expo Router
- TypeScript
- Firebase Auth
- Firestore
- Firebase Storage
- Firebase Functions
- RevenueCat
- Expo Notifications
- Expo Location
- `react-native-maps`

## Security Model

The repo is public, but the live app should be protected by Firebase rules and private environment variables.

Important security choices:

- `.env` is ignored and must not be committed.
- Firestore rules deny public reads/writes.
- Storage rules deny public reads/writes.
- Only approved members can read club data.
- Pending users can only create/cancel their own join request.
- Users can only update their own profile/account fields.
- Image uploads are limited to image content under 10 MB.
- Admin/officer writes are role-gated and subscription-aware.
- Firebase Functions use server-side permissions for sensitive actions.

See [SECURITY.md](SECURITY.md) before deploying your own clone.

## Local Setup

1. Clone the repo.
2. Install dependencies:

```bash
npm install --legacy-peer-deps
```

3. Copy the environment template:

```bash
cp .env.example .env
```

4. Create a Firebase project and add your web app config to `.env`.
   If your Firestore database ID is `default`, set:

```bash
EXPO_PUBLIC_FIRESTORE_DATABASE_ID=default
```

   If your project uses Firebase's implicit `(default)` database, you can omit that variable.
5. Enable Firebase Auth email/password sign-in.
6. Create Firestore, Storage, and Functions.
7. Set your first owner email:

```bash
EXPO_PUBLIC_OWNER_EMAILS=owner@example.com
```

8. For Android builds, add a restricted Google Maps API key:

```bash
GOOGLE_MAPS_ANDROID_API_KEY=your-restricted-android-maps-key
```

The key should be restricted in Google Cloud to the Android package `app.mostudios.presidentsmc` and the SHA-1 certificate for the build you are shipping. iOS uses Apple Maps by default in the app.

9. Set Firebase CLI project:

```bash
firebase use --add
```

10. Deploy rules:

```bash
firebase deploy --only firestore:rules,storage --project your-firebase-project-id
```

11. Run the app:

```bash
npm run start
```

## Development Commands

```bash
npm run start
npm run web
npm run lint
npx tsc --noEmit
npm run test:rules
```

`npm run test:rules` uses Firebase emulators and needs Java installed locally.

## Cloning and Reuse

You are free to clone this repo and adapt it for your own club, group, or private community app.

Before using it for your own project:

- Replace all app branding.
- Use your own Firebase project.
- Use your own RevenueCat project/products.
- Deploy your own Firestore and Storage rules.
- Review the security rules for your data model.
- Do not reuse another club's private assets, photos, names, or copy.

## Notes

This app is still evolving. The current codebase started from an Expo starter, pulled in the useful parts of the earlier Crew app, then was reshaped into a single-club PresidentsMC experience with black/silver biker-club styling.
