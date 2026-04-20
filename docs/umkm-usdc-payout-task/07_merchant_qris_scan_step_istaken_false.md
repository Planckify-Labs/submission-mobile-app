# Task 07 — Merchant QRIS scan + sticker photo capture

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §1.1.1 step 2 (scan path),
§6.1 (`MerchantSignupRequest.qrisLink`), §11.1 deps row
(`expo-image-picker`/`expo-image-manipulator`), §12 Q9

## Why this matters

Scanning the merchant's own QRIS sticker gives us `merchant PAN`, display
name, and country **for free** and shrinks the signup form. Capturing a
lightweight photo of the sticker is our v1 mitigation against false PAN
claims (§12 Q9) — dispute evidence without any acquirer API access.

## Scope

- Create `app/merchant/qris-scan.tsx`:
  - Open `expo-camera` (reuse the permission gate from `app/scan-to-pay.tsx`).
  - On barcode detection, run the EMVCo decoder from task 03 **directly**
    (do not route through the paymentIntent classifier — this is a merchant
    signup flow, not a payer scan).
  - Extract: `qrisPan` (tag 26 sub-02), `displayName` (tag 59 — ALL CAPS),
    `country` (tag 58).
  - Capture the current camera frame as JPEG; compress via
    `expo-image-manipulator` to ≤200 KB at ≤1280 px long edge.
  - On success → `router.replace("/merchant/signup-form", { ...parsed,
    stickerPhotoUri })`.
  - On CRC failure / non-QRIS EMVCo → inline toast: *"That doesn't look like
    a QRIS sticker. Try again or enter details manually."* with a "Switch to
    manual" button linking to `/merchant/signup-form` with empty state.
- Add `expo-image-picker`, `expo-image-manipulator` as deps if not already
  present; pin versions compatible with Expo 54.
- No upload yet — the photo URI is passed forward and uploaded by task 08
  as part of the `signup` POST.

## Rules (non-negotiable)

- **No backend calls here.** Capture, decode, hand off.
- **Compressed JPEG only.** Never forward a raw full-res capture — bandwidth
  cost on Indonesian networks is real.
- **Preserve camera permission UX.** If permission is denied, show the same
  deep-link-to-Settings pattern the payer scanner uses.
- **Do not persist the photo to Photos / gallery.** It's a private upload
  artifact.

## Acceptance

- [ ] Screen renders; scanning a valid QRIS populates
      `{ qrisPan, displayName, country, stickerPhotoUri }` on the next route.
- [ ] Bad CRC path shows the toast and does not crash.
- [ ] JPEG size after compression consistently <200 KB on a modern device.
- [ ] Grep: `app/merchant/qris-scan.tsx` does not import
      `services/paymentIntent/*` (task 03 exports the decoder separately —
      extract the TLV+CRC helper into `services/emvco/` if reuse requires
      it; that extraction is part of this task).
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Uploading the photo (task 08, as part of `signup` POST).
- Merchant form fields (task 08).
