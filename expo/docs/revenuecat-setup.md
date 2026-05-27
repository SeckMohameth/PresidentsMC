# RevenueCat Setup

## Products

The app expects these exact identifiers:

- Entitlement: `PresidentsMC Pro`
- Monthly product ID: `monthly`
- Yearly product ID: `yearly`
- Monthly price: `$3.99`
- Yearly price: `$34.99`

Create matching subscriptions in App Store Connect and Google Play Console, then import or attach them in RevenueCat.

## Legal URLs

Use these links anywhere the stores ask for subscription, privacy, or terms metadata:

- Privacy Policy: `https://sites.google.com/view/presidentsmc-privacy/home`
- Terms of Use: `https://sites.google.com/view/presidentsmc-terms/home`

## Access Model

PresidentsMC is a private club app. Members can sign up, request access, and be approved for free.

Free admins can:

- Approve and manage members.
- Create announcements.
- Manage invite access.

The club subscription unlocks:

- Creating and managing rides.
- Creating club photo albums.
- Ride/photo-driven stats.

One active admin subscription marks the club subscription active for the club. Clubs can decide internally which admin pays or rotates payment.

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

For each subscription, complete the required metadata before review:

- Add localization metadata, including display name and description.
- Set price, availability, and subscription duration.
- Add the App Review screenshot showing the in-app subscription paywall.
- Add the Privacy Policy and Terms of Use links above where Apple asks for them.
- For the first subscription review, upload a new app build and select these subscriptions from the app version's **In-App Purchases and Subscriptions** section before submitting the app version to App Review.

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

If RevenueCat says there are no products available to import, create the products manually with the exact product IDs above. App Store Connect products often will not import until their metadata is complete and Apple has accepted the first subscription submission with an app version.

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
- Paywall opens from **More -> Club Subscription** for admins only.
- Regular members do not see **Club Subscription** and cannot use `/subscription` directly.
- Purchase unlocks `PresidentsMC Pro`.
- One active admin subscription covers the club and blocks duplicate purchases by other admins.
- Restore purchases updates access.
- Customer Center opens.
- Paid features unlock ride and album creation while free admin actions remain available.
