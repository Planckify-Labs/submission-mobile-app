# Task 20 — Flip `FEATURE_SUI_DAPP_BRIDGE` to `true`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §13 (task 20), §15 (PR 9).

## Why this matters

Single-line diff PR. After this lands, every Sui dApp opened in the
in-app browser sees TakumiPay as a Wallet Standard wallet. All
preceding tasks must be green; this is the ship line.

## Scope

- Flip `FEATURE_SUI_DAPP_BRIDGE` from `false` → `true` in
  `services/bridge/boot.ts` (the constant introduced by the wallet-kit
  spec §5).
- Bump CHANGELOG / release notes if the project tracks them.
- Coordinate with wallet-kit spec to ensure
  `walletKitRegistry.has("sui") === true` ships in the same release —
  otherwise the boot guard (Task 14) keeps the bridge dormant and the
  ship is silent.

## Rules (non-negotiable)

- **Pre-req checklist must be 100% green:**
  - Tasks 00–18 finished (bridge implementation + AI-readiness).
  - Task 19 manual smoke green; quirks documented.
  - Task 22 TWV-2026-YYY design note merged.
  - Wallet-kit spec deliverables that this depends on: kit registration,
    `getSuiSignerForWallet` dwell site.
- **Single-line diff PR.** No drive-by changes. Easy to revert.
- **Roll-back plan documented.** Flipping back to `false` plus restart
  disables Sui dApp signing without restoring the EVM/Solana state —
  verify in a dev environment before merging.

## Acceptance

- [ ] Flag set to `true`.
- [ ] Cold boot on iOS + Android: Sui adapter active, signer installed.
- [ ] One live dApp sign on testnet from the production build of this
      branch.
- [ ] Roll-back tested locally.

## Out of scope

- Any code changes beyond the flag.
- Marketing / announcement (ops).
