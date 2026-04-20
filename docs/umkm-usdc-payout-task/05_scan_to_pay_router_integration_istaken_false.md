# Task 05 — Wire `classify()` into the scanner + `/pay-merchant` stub

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §4.6, §2 (user journey steps
4–6), §11 M1 exit criteria

## Why this matters

Today `app/scan-to-pay.tsx:29-62` only recognizes raw EVM / Solana addresses
and never switches `activeChain` when it routes. This task rewires the
scanner to run the classifier (tasks 01–04), dispatch to the right screen,
and — critically — pre-switch `activeChain` via a single `useWallet` helper
so the memory rule *no `if (ns === "X")` branches in shared files* holds.

## Scope

- Add `switchToScannedTarget(target: PayChannel & { kind: "wallet" })` to
  `hooks/useWallet.ts` as described in §4.6. Under the hood:
  1. Resolve `ChainConfig` from `supportedChains` (EVM) or Solana cluster
     table.
  2. If `activeWallet.namespace` already matches → `setActiveChain(config)`.
  3. Otherwise `setActiveWallet(firstWalletInTargetNamespace)` then
     `setActiveChain(config)` — mirror the invariant in
     `app/wallet.tsx:68-85`.
  - **Not** a new `WalletKitAdapter` method — wallet-activation is an app
    concern (memory `feedback_chain_extension_discipline.md`).
- Rewrite `app/scan-to-pay.tsx:handleBarCodeScanned` to:
  1. `const intent = await classify(result.data);`
  2. Unrecognized → keep existing "unrecognized QR" toast + `setScanned(false)`.
  3. `wallet` → `await switchToScannedTarget(...)` → `router.replace("/send", ...)`
     with existing param shape.
  4. `merchant` → `router.replace("/pay-merchant", { intent: JSON.stringify(intent) })`.
  5. `x402` → same `/pay-merchant` route.
- Create `app/pay-merchant.tsx` as a **stub**: parse `intent` param, render
  the JSON fields and a disabled "Pay" button. Networking / signing land in
  later milestones. Keep this screen ≤120 lines.
- Import `detectors/index.ts` once at app boot so every detector is
  registered before the scanner fires. Good place: the same module today
  imports `chainConfig.ts` at startup.

## Rules (non-negotiable)

- **No chain-specific `if` branches in `app/scan-to-pay.tsx`.** The only
  namespace read allowed is *via* `switchToScannedTarget`.
- **Scanner must not hit the network.** `classify()` includes async JWS
  verify (task 04) but no HTTP — do not add any here either.
- **Preserve existing toasts and scanned-guard semantics.** Regression-test
  the "scanned the same QR twice in 1 s" flow.
- **Stub `/pay-merchant` must not import `viem`.** It's a dumb renderer for M1.
- **Three-role separation** (memory `feedback_role_separation.md`): the
  scanner never signs, never fetches, never decides amounts.

## Acceptance

- [ ] `pnpm check:syntax` passes.
- [ ] Manual smoke: scan a valid TakumiPay JWS → `/pay-merchant` shows
      merchantId + currency; scan a tampered JWS → "unrecognized QR" toast;
      scan a raw EVM address while active chain is Solana → `/send` opens
      with the EVM active chain already selected.
- [ ] Grep in `app/scan-to-pay.tsx` for `eth_|solana|if (ns|namespace === "`
      returns zero matches.
- [ ] `app/pay-merchant.tsx` ≤120 lines and imports nothing from
      `services/walletKit/*`.
- [ ] M1 exit criteria (spec §11): user can scan QRIS/TakumiPay QR and see
      parsed fields.

## Out of scope

- `/send` UX changes (existing behavior kept intact).
- Any real payment execution (milestones M2–M5).
