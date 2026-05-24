# RevenueCat Setup

## Installed SDKs

Installed with Expo:

```bash
npx expo install react-native-purchases react-native-purchases-ui
```

RevenueCat requires a full Expo dev/production build after adding these native modules. Expo Go or hot reload alone is not enough for first install.

## App Configuration

The app uses:

- API key: `test_yCWPzNoPOGccAdoqidlUuuERyxa`
- Entitlement identifier: `PresidentsMC Pro`
- Monthly product id: `monthly`
- Yearly product id: `yearly`
- Suggested monthly price: `$3.99`
- Suggested yearly price: `$39.99` (`16%` yearly savings)

Local Expo environment:

```bash
EXPO_PUBLIC_ENABLE_REVENUECAT=true
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=test_yCWPzNoPOGccAdoqidlUuuERyxa
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=test_yCWPzNoPOGccAdoqidlUuuERyxa
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_yCWPzNoPOGccAdoqidlUuuERyxa
```

For EAS builds, add the same values as EAS environment variables or secrets.

## RevenueCat Dashboard

1. Create products in App Store Connect:
   - `monthly`
   - `yearly`

2. In RevenueCat, import or create matching products:
   - `monthly`
   - `yearly`

3. Create entitlement:
   - `PresidentsMC Pro`

4. Attach both products to `PresidentsMC Pro`.

5. Create an offering and make it current.
   - Add monthly package for `monthly`.
   - Add annual/yearly package for `yearly`.

6. Create a RevenueCat Paywall for the current offering.
   - Use the same visual direction as the app paywall.
   - Recommended hero asset: `assets/images/custom-images/harley-davidson-aiBYhrzsQw4-unsplash.jpg`.

7. Configure Customer Center if you want in-app subscription management, restore, refund request, and support actions.

## Code Entry Points

- RevenueCat configuration and state: `providers/RevenueCatProvider.tsx`
- RevenueCat constants: `constants/revenueCat.ts`
- Hosted paywall flow: `app/create-crew-paywall.tsx`
- Subscription management entry point: `app/(tabs)/more/index.tsx`

## Testing

After dashboard setup:

```bash
npx eas build --profile development --platform ios
```

Install that build and test:

- Customer info loads without SDK errors.
- `PresidentsMC Pro` unlocks after purchase.
- Restore purchases updates customer info.
- Paywall opens from crew creation.
- Customer Center opens from More > Manage Subscription.

For production:

```bash
npx eas build --platform ios --profile production
```

Then submit after the build succeeds.
