# Task 02 — Wallet address + URI detectors

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §4.3 items 4 & 5, §4.6

## Why this matters

Preserve today's `handleBarCodeScanned` behavior (raw EVM `0x…` and Solana
base58) while extending it to understand EIP-681 and `solana:` URIs so the
scanner can auto-switch `activeChain` to the URI's target (the missing piece
in `app/scan-to-pay.tsx:44-57`).

## Scope

Create under `services/paymentIntent/detectors/`:

- `walletAddress.ts` — recognises:
  - `0x[0-9a-fA-F]{40}` → `{ kind: "wallet", namespace: "eip155" }` with
    `target: undefined` (no chain hint).
  - Solana base58 that passes `isValidSolanaAddress(...)` →
    `{ kind: "wallet", namespace: "solana" }`, `target: undefined`.
- `walletUri.ts` — recognises:
  - `ethereum:<addr>[@chainId][/transfer?...]` per EIP-681. Parse `chainId`,
    optional `amount`, optional `token` (ERC-20 contract). Populate
    `target: { namespace: "eip155", chainId }`.
  - `solana:<addr>[?cluster=…]`. Default cluster `mainnet-beta`.
- Register both detectors at priority `40` (address) and `30` (URI) so URI
  wins when both could plausibly match a string.
- Unit tests (`*.test.ts`) per detector covering at minimum: happy path, the
  "no chain hint" fallback, malformed input, and mixed-case EVM addresses.

## Rules (non-negotiable)

- **Pure functions only.** No React, no networking, no chain clients.
- **Return `null` on mismatch.** Never throw on "unrecognized input" — the
  classifier reads `null` as "next detector, please."
- **Do not call `useWallet` or read `activeChain`.** Detectors are stateless;
  chain switching is the scanner's job (task 05).
- **`bigint` for amounts.** Never parse into `number` — EIP-681 can carry
  wei-denominated values.

## Acceptance

- [ ] Both detector files exist with passing unit tests.
- [ ] Boot-time `register(...)` calls live in a single `detectors/index.ts`
      that task 05 imports.
- [ ] Grep shows no `react`, `react-native`, `viem`, or `fetch` imports in
      the new files (Solana base58 validation uses an existing helper from
      the wallet codebase — do not add a new dependency).
- [ ] `pnpm check:syntax` passes.

## Out of scope

- EMVCo / TakumiPay / x402 detectors (tasks 03, 04, 23).
- `switchToScannedTarget` wiring (task 05).
