# Task 04 — TakumiPay signed-QR detector

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §4.4, §4.6 (detector code
block), §9 ("QR authenticity"), §10 (`EXPO_PUBLIC_TAKUMIPAY_QR_PUBKEY_JWK`)

## Why this matters

The TakumiPay JWS QR is our signed merchant credential. Verifying the
signature **on-device before routing** gives us a trusted `merchantId` with
zero network roundtrips — backend can skip its merchant lookup. A tampered
JWS must never reach `/pay-merchant`.

## Scope

Create:

- `constants/takumipayKey.ts` — exports `publicKeyJwk` read from
  `process.env.EXPO_PUBLIC_TAKUMIPAY_QR_PUBKEY_JWK` (Base64url-encoded JWK
  JSON). Fail loud at import-time on missing / malformed env.
- `services/paymentIntent/detectors/takumipay.ts` per §4.6:
  - Strip the `takumipay:v1:` prefix; `jwtVerify` with `ES256` and the
    imported JWK; map the verified payload to
    `{ kind: "merchant", provider: "takumipay", merchantId, amountMinor,
      currency, rawPayload }`.
  - Import `react-native-get-random-values` (or the existing polyfill used
    elsewhere in the app) **before** the first `jose` call.
  - On verify failure → return `null`. No throw. No partial result. Never
    forward a tampered QR.
- Register at priority `10` (highest; §4.3 item 1).
- Unit tests covering: valid JWS round-trips (sign with a fixture private
  key, verify with its public JWK), wrong-alg rejection, expired `exp`,
  tampered body, missing prefix.
- Add `jose` to `package.json` per §11.1 M1 row. Pick the browser build;
  verify it works under Hermes with the polyfill.

## Rules (non-negotiable)

- **Local verification is mandatory.** Do not accept the JWS on the strength
  of the `takumipay:v1:` prefix alone.
- **Public key lives in env + app bundle.** Rotation is an EAS OTA update
  (same channel as `EIP7702_ALLOWLIST`); no runtime-fetched keys.
- **Async detect is the exception.** The classifier (task 01) already awaits
  every detector; do not smuggle a top-level-await into the registry.
- **No React imports.** `services/paymentIntent/detectors/*` must stay node-
  testable.

## Acceptance

- [ ] Detector file exists with passing unit tests (at least one valid, one
      tampered, one expired).
- [ ] Registered in `detectors/index.ts` at priority `10`.
- [ ] `EXPO_PUBLIC_TAKUMIPAY_QR_PUBKEY_JWK` appears in `.env.example` per §10.
- [ ] `jose` pinned in `package.json`; polyfill import documented at the top
      of the detector file.
- [ ] Grep for `takumipay:v1:` in `app/` outside `docs/` returns only the
      detector file and (later, task 05) scanner integration.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Rotating the key server-side (that's a `takumipay-api` runbook item).
- Rendering the merchant's own JWS QR (task 09).
