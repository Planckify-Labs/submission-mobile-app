# Task 15 — `/pay-merchant` end-to-end (Nanopay happy path)

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §2, §5.2, §5.5 (happy-path
wiring block), §5.6 (Path Selector — Nanopay branch only for this task),
§11 M2 exit criteria

## Why this matters

This is where the user presses Pay and the merchant sees PAID in <500 ms.
It's the M2 Shippable demo. Every previous M2 task converges here.

## Scope

Rewrite `app/pay-merchant.tsx` from the M1 stub to a functional screen:

- Parse `intent` route param (the `PaymentIntent` handed off by task 05).
- Call `useCreateIntent()` with `{ merchant, amountMinor, currency: "IDR",
  sourceHint: { namespace: "eip155", chainId: EXPO_PUBLIC_NANOPAY_SOURCE_CHAIN_ID } }`.
- Render the `PaymentIntent` (§6.2) as the source-of-truth screen:
  - Merchant display name.
  - Fiat amount as the prominent value (IDR). USDC is shown secondary,
    formatted from `intent.usdc.amountMicros`.
  - FX rate + fee breakdown summary line.
  - 60 s quote-expiry countdown. On expiry → re-create intent silently,
    update the display. `QUOTE_EXPIRED` matrix row is the fallback if the
    resubmit fails.
- On **Pay**:
  1. Require PIN / biometric (existing lock-gate hook).
  2. `buildAuthorization({ nanopay: intent.nanopay!, wallet, chain })`.
  3. `kit.signTransferWithAuthorization(payload)`.
  4. `useSubmitNanopay({ intentId, signature, payload })`.
  5. On `SETTLED` → `router.replace("/pay-merchant/receipt", { intentId })`
     (task 18).
  6. On failure → `<PaymentError code={…} />` (task 16) with the matching
     CTA.
- If `intent.gasless.requiresDeposit: true` → render the
  **`REQUIRES_DEPOSIT`** row from the error matrix with CTA
  `/onboarding/nanopay-deposit` (task 21). Block the Pay button.
- If the active wallet namespace is `"solana"` at screen mount → auto-switch
  to the user's EVM wallet under the same account (§5.5 option (b)); if no
  EVM wallet exists, show `WALLET_NAMESPACE_MISMATCH` error row.

## Rules (non-negotiable)

- **Three-role separation** (memory `feedback_role_separation.md`): server
  decides amounts (quote), wallet signs, user confirms fiat. The screen
  never invents an amount or picks a chain.
- **Screen does not import `viem`.** Signing goes through `WalletKitAdapter`.
- **Presence-gated feature** (§5.5): if
  `kit.signTransferWithAuthorization` is `undefined`, disable Pay and show
  the namespace-mismatch error — never branch on namespace strings.
- **Re-quote on screen focus.** If the user backgrounds the app for >5 min
  (`INTENT_EXPIRED` row), silently re-create the intent on foreground.
- **Flag gate for M2 demo:** wrap the screen entry with a server-driven
  feature flag so we can dark-launch.
- **Avoid `useEffect`** for derived state (skill `avoid-useeffect`). Use
  `useMemo` for the fiat↔USDC display and `useCallback` for the Pay handler.

## Acceptance

- [ ] Manual: scan a TakumiPay JWS → quote renders → Pay → PIN → attestation
      shows in <2 s round-trip against staging backend + Circle Nanopay
      testnet.
- [ ] Error paths for `SIGNATURE_INVALID`, `NONCE_REUSED`,
      `INSUFFICIENT_GATEWAY_BALANCE`, `QUOTE_EXPIRED`,
      `CIRCLE_UPSTREAM_ERROR` each render their matrix row.
- [ ] `REQUIRES_DEPOSIT` renders the onboarding CTA but does not navigate
      automatically.
- [ ] Grep in `app/pay-merchant.tsx` for `viem` returns zero matches.
- [ ] `pnpm check:syntax` + `pnpm lint` pass.

## Out of scope

- Xendit payout display (task 18 owns receipt + PAID_OUT banner).
- Paths A and C (tasks 23–25).
