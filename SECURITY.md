# Security Notes

This repository is public, so deployment security depends on your Firebase project configuration, environment variables, and rules.

## Do Not Commit

Never commit:

- `.env`
- Firebase service account JSON files
- Apple/Google signing keys
- RevenueCat secret keys
- Firebase debug logs
- Any admin email list you do not want public
- Real private club/member data

The repo includes `.env.example` only as a template.

## Firebase Rules

The included `firestore.rules` and `storage.rules` are designed for a single private club:

- No public Firestore reads.
- No public Storage reads.
- Only approved members can read club content.
- Pending users can only create/cancel their own join request.
- Members can update their own profile, RSVP/check in, and upload ride photos.
- Admin/officer writes are role-gated.
- Image uploads are limited to image content under 10 MB.

Deploy them before inviting real users:

```bash
firebase deploy --only firestore:rules,storage --project your-firebase-project-id
```

## Firebase Console Checklist

In Firebase Console:

- Enable Authentication > Email/Password.
- Disable unused auth providers.
- Keep Firestore rules in locked mode.
- Keep Storage rules in locked mode.
- Review API key restrictions in Google Cloud if needed.
- Set Firebase budget alerts.
- Limit Cloud Functions IAM access to project admins.
- Add App Check before a production launch if you need stronger abuse protection.

## First Owner Bootstrap

The app can bootstrap the first owner from `EXPO_PUBLIC_OWNER_EMAILS`, but the rules only allow this before the `crews/presidents-mc` document exists.

After the first club document exists, nobody can self-promote to owner/admin through client writes.

## Public Firebase Web Config

Firebase Web config values are not treated as secret. Security comes from:

- Auth
- Firestore rules
- Storage rules
- Cloud Functions permissions
- App Check/rate limits/billing alerts

Still, for a public repo, keep real project values in `.env` and use placeholders in `.env.example`.

## Reporting Issues

If you clone this project and find a security issue in the template rules or app flow, open an issue or patch it in your fork.
