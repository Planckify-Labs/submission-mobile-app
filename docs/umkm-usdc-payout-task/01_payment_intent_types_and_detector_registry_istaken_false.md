# Task 01 — `PaymentIntent` types + detector registry

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §4.1, §4.2, §4.5

## Why this matters

Every downstream screen (`/pay-merchant`, `/send`, receipts) reads a
`PaymentIntent`. Locking its shape first — along with a pluggable detector
registry — is what makes §4.6 a thin switch rather than a nest of
chain/country branches. This task ships the types and registry only; real
detectors land in tasks 02–04.

## Scope

Create:

- `services/paymentIntent/types.ts` exporting `RawScan`, `PayChannel`,
  `PaymentIntent` exactly as written in §4.2. Include the `PayChannel.target`
  discriminated form so chain auto-switch (§4.6) has a typed contract.
- `services/paymentIntent/detectorRegistry.ts` exporting `Detector` interface,
  module-local array, `register()`, and `runAll(raw)` — supporting async
  `detect` returns (the TakumiPay JWS detector is the asynchronous one, §4.6).
- `services/paymentIntent/classify.ts` — thin wrapper that awaits each
  registered detector in priority order and returns the first hit or `null`.
- `services/paymentIntent/classify.test.ts` — empty-registry returns `null`;
  priority ordering respected; first-match-wins.
- `services/paymentIntent/index.ts` barrel export.

## Rules (non-negotiable)

- **No React imports.** `services/paymentIntent/*` must be importable from a
  node-only test harness.
- **No networking imports.** No `fetch`, no API clients.
- **`classify()` is the only entry point consumers touch.** Detector array
  stays module-private; callers register at boot.
- **Chain-extension discipline** (memory `feedback_chain_extension_discipline.md`):
  adding a new country's QR must be `register(newDetector)` in a boot file — no
  changes to `classify.ts` or `scan-to-pay.tsx`.

## Acceptance

- [ ] Files above exist with the exported surfaces in §4.2 / §4.5.
- [ ] `classify.test.ts` runs under `pnpm jest` (node env) and passes.
- [ ] Grep shows no imports of `react`, `react-native`, `viem`, or `fetch`
      inside `services/paymentIntent/types.ts`, `detectorRegistry.ts`, or
      `classify.ts`.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Any concrete detector (tasks 02–04).
- Scanner wiring (task 05).
