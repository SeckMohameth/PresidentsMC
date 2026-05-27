# RevenueCat Setup

## Products

The app expects these exact identifiers:

- Entitlement: `PresidentsMC Pro`
- Monthly product ID: `monthly`
- Yearly product ID: `yearly`
- Monthly price: `$3.99`
- Yearly price: `$34.99`

Create matching subscriptions in App Store Connect and Google Play Console, then import or attach them in RevenueCat.

## App Store Connect

Create two auto-renewable subscriptions:

- Reference name: `PresidentsMC Monthly`
  - Product ID: `monthly`
  - Duration: 1 month
  - Price: `$3.99`
- Reference name: `PresidentsMC Yearly`
  - Product ID: `yearly`
  - Duration: 1 year
  - Price: `$34.99`

## Google Play Console

Use the same product IDs:

- `monthly`
- `yearly`

Set the same pricing unless you intentionally localize pricing by country.

## RevenueCat Dashboard

1. Create or import products:
   - `monthly`
   - `yearly`
2. Create entitlement:
   - `PresidentsMC Pro`
3. Attach both products to `PresidentsMC Pro`.
4. Create an offering and make it current.
   - Add monthly package for `monthly`.
   - Add annual/yearly package for `yearly`.
5. Create a RevenueCat hosted paywall for the current offering.
6. Configure Customer Center so users can manage subscriptions and restore purchases.

## Environment

Set these locally and in EAS secrets:

```bash
EXPO_PUBLIC_ENABLE_REVENUECAT=true
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=...
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=...
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=...
```

## Testing

RevenueCat native purchases require a development build, TestFlight, or production build. Expo Go is only useful for basic UI checks.

Test before store submission:

- Plans load from RevenueCat.
- Hosted paywall opens from crew creation.
- Purchase unlocks `PresidentsMC Pro`.
- Restore purchases updates access.
- Customer Center opens.
- Crew creation records active billing status after purchase.
