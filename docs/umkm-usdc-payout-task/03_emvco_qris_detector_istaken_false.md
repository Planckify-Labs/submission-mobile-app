# Task 03 — EMVCo QRIS detector

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §4.3 item 3, §9 ("QR
authenticity"), §11.1 (dep row for `@emvco-qrcps/parser`)

## Why this matters

An Indonesian UMKM's existing QRIS sticker is the primary scan target — most
already have one (BI has mandated QRIS for new merchant QRs since 2020).
Decoding it client-side lets the classifier route to `/pay-merchant` with a
concrete `provider: "xendit_qris"` without a network roundtrip; the backend
then resolves the merchant from the raw payload.

## Scope

Create:

- `services/paymentIntent/detectors/emvco.ts` — parses EMVCo Consumer-Presented
  TLV, validates the trailing CRC-16/CCITT-FALSE checksum, and inspects tags
  26–29 for the QRIS acquirer signature. On valid QRIS → return
  ```
  { kind: "merchant", provider: "xendit_qris", merchantId: "",
    rawPayload: raw,
    amountMinor: <tag 54 parsed IDR minor units if present>,
    currency: "IDR" }
  ```
  Server fills `merchantId` at intent creation. `merchantId` stays empty
  string locally — the type already allows it.
- Library choice per §11.1: `emv-qr-cps` off npm if it's up to date, else a
  short (~120 LoC) in-repo TLV + CRC-16 implementation. Either is fine —
  tests are the contract.
- Register at priority `20` (below TakumiPay JWS but above wallet URI).
- Unit tests covering: real QRIS fixtures (static + dynamic), bad CRC,
  missing tag 26/27/28/29, open-amount (no tag 54) path.
- When the QR is EMVCo but **not** QRIS (e.g. PromptPay / PayNow / DuitNow /
  VietQR — detected via tags 27/28/29/26 acquirer), return `null` for v1
  and log via the shared telemetry hook. Per §12 Q3 those countries are
  out of v1; shipping them later is a new detector, not a change here.

## Rules (non-negotiable)

- **Pure function.** No React, no networking.
- **CRC must be validated before returning a hit.** A bad CRC is `null` with
  no log spam — the user may have scanned a torn sticker. The user-facing
  error (`QR_UNRECOGNIZED`) is surfaced by the classifier, not this detector.
- **Never trust merchant name / amount from the QR for display as-is on
  `/pay-merchant`.** The backend-resolved merchant profile is the source of
  truth. We use EMVCo fields only for routing and as echoed raw payload.

## Acceptance

- [ ] `services/paymentIntent/detectors/emvco.ts` exists with passing unit
      tests (at least five fixtures, including one with a known-bad CRC).
- [ ] Boot-registered in `detectors/index.ts` at priority `20`.
- [ ] Grep shows no `react`, `react-native`, or `fetch` imports in the new
      file.
- [ ] If `emv-qr-cps` (or similar) is introduced, pin the exact version in
      `package.json`.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- PromptPay / DuitNow / VietQR / QR Ph detectors (§12 Q3 defers to v1.1+).
- Backend merchant resolution (`takumipay-api` side).
- Scanner wiring (task 05).
