# PresidentsMC

PresidentsMC is a private motorcycle club app for rides, announcements, members, shared albums, club stats, and road memories.

This folder contains the Expo app. See the root [README](../README.md) for the public project overview.

## Local Development

From the repo root:

```bash
bun install --cwd expo
bun run start
```

From this folder:

```bash
bun install
bun run start
```

Useful checks:

```bash
bun run lint
bun x tsc --noEmit
bunx expo-doctor
```

## Configuration

Copy the example environment file and fill in your own Firebase and RevenueCat values:

```bash
cp .env.example .env
```

The real `.env` file is intentionally ignored by git. Do not commit store credentials, Firebase service-account keys, RevenueCat webhook secrets, or App Store / Google Play private keys.

For store subscription setup notes, see [RevenueCat setup](./docs/revenuecat-setup.md).
