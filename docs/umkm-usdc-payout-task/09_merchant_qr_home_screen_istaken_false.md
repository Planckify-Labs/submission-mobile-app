# Task 09 — Merchant QR home screen

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §1.1.1 step 4, §6.1
(`MerchantQrResponse`), §11.1 (`react-native-qrcode-svg`)

## Why this matters

Once onboarded, a merchant needs a printable TakumiPay QR **today**.
`app/merchant/qr.tsx` is both the signup terminus and the Profile/Settings
re-entry point.

## Scope

- Create `app/merchant/qr.tsx`:
  - Top: merchant `displayName` + contact phone (redacted).
  - Center: JWS QR rendered via `react-native-qrcode-svg` at 400×400, error
    correction `M` (10%), margin per sticker print guidance.
  - Below QR: **"Save to Photos"** (writes a framed PNG with brand border,
    file named `takumipay-qr-<merchantId>.png`) and **"Share"** (system
    share sheet — WhatsApp, email, AirDrop, print).
  - If `merchant.qrisPan` is non-null: muted helper line *"Your existing
    QRIS sticker also works — customers can pay either one."*
  - Bottom-right quiet menu link "Payouts" → stub screen for now (deferred
    v1.1 per spec).
- Two data sources:
  1. `GET /v1/merchants/me` for the profile + embedded `qr.jws` (use
     TanStack Query).
  2. "Re-issue QR" menu action → `GET /v1/merchants/me/qr` to rotate the
     `iat` and swap the displayed code. Invalidate the me-query on success.
- Save-to-Photos / Share writes the PNG via the SVG `.toDataURL(...)` API
  that `react-native-qrcode-svg` exposes; compose the branded frame with a
  canvas-style overlay.
- Expose the same screen from **Profile / Settings** when the current user
  has a merchant profile on record.

## Rules (non-negotiable)

- **Never store the JWS in clipboard** (see `docs/clipboard-policy.md`).
  "Share" uses the system share sheet; "Save to Photos" writes an image,
  not text.
- **Single source of truth.** Display the `MerchantProfile` from
  `/merchants/me`; do not duplicate fields into local state that could drift.
- **No re-encoding the JWS client-side.** Render the server-issued
  `qr.jws` string verbatim — mismatched iat would invalidate the JWS under
  task 04's verifier.

## Acceptance

- [ ] Screen renders with live profile + QR; pinch/zoom is NOT supported
      (print quality is a server-render concern).
- [ ] Save-to-Photos produces a file that, when re-scanned on a second
      device, decodes to the same JWS and is accepted by task 04's
      detector.
- [ ] Share sheet fires on all three targets (WhatsApp, email, printer).
- [ ] Profile/Settings deep link to this screen works for returning
      merchants.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Payouts / reconciliation screen (deferred v1.1 per §1.1.1).
- Multi-staff / merchant web portal (post-v1 per §1.1.1 closing paragraph).
