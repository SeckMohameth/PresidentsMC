# App Review Subscription Metadata

Apple rejected build `1.0 (18)` on June 02, 2026 because the App Store metadata did not include a functional Terms of Use (EULA) link for auto-renewable subscriptions.

## Required Store Metadata

Add this line to the end of the App Store Connect app description, or add the same URL in the EULA field if using a custom EULA:

```text
Terms of Use (EULA): https://sites.google.com/view/presidentsmc-terms/home
```

Confirm the App Store Connect privacy policy field is set to:

```text
https://sites.google.com/view/presidentsmc-privacy/home
```

## Link Status

Checked on June 02, 2026:

- Privacy Policy returns `HTTP 200`.
- Terms of Use currently returns `HTTP 302` to `accounts.google.com/ServiceLogin`.

Before resubmitting, publish the Terms of Use Google Site publicly so reviewers can open it without a Google login. In Google Sites, use **Publish** and set the published site visibility so anyone can view it.

## Reviewer Reply

Use this in App Review after the public Terms link is fixed and the App Store metadata is updated:

```text
Hello,

We updated the App Store metadata for PresidentsMC to include the required Terms of Use (EULA) link for auto-renewable subscriptions:

Terms of Use (EULA): https://sites.google.com/view/presidentsmc-terms/home

The Privacy Policy field remains:
https://sites.google.com/view/presidentsmc-privacy/home

The app also includes the subscription title, subscription lengths, prices, auto-renewal disclosure, and functional Terms of Use and Privacy Policy links on the Club Subscription screen.

Thank you.
```

## App Review Notes

Add this to the **Notes** field under App Review Information for future submissions:

```text
PresidentsMC offers auto-renewable subscriptions on the Club Subscription screen.

The screen displays:
- Subscription title: PresidentsMC Pro
- Subscription lengths: monthly and yearly
- Prices: $3.99/month and $34.99/year
- Auto-renewal and cancellation disclosure
- Terms of Use: https://sites.google.com/view/presidentsmc-terms/home
- Privacy Policy: https://sites.google.com/view/presidentsmc-privacy/home

The Terms of Use link is also included in the App Store description/EULA metadata.
```
