# Task 24 — Path A: direct-on-Arc ERC-20 transfer

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §5.1, §5.4 (gasless table row),
§7, §11 M5

## Why this matters

For large transfers where Nanopay batch latency matters, or as a fallback
when the user already holds USDC on Arc, Path A settles immediately on-chain.
USDC is the gas token on Arc, so it's a single ERC-20 `transfer`.

## Scope

- Extend `WalletKitAdapter` with a tokenized write path per §7's follow-up
  note (*"tokenized write path on `WalletKitAdapter` so we stop piggybacking
  on `erc20Abi` calls inline from `app/send.tsx:414-421`"*). Shape:
  ```ts
  sendTokenTransfer(args: {
    wallet: TWallet;
    chain:  ChainConfig;
    token:  `0x${string}`;
    to:     `0x${string}`;
    amount: bigint;
  }): Promise<{ txHash: `0x${string}` }>;
  ```
  The method likely already exists — §5.1 references it. If it does, audit
  and harden instead of re-creating; if it doesn't, add it and migrate
  `app/send.tsx` over.
- Implement Path A in `services/payExecutor/direct_arc.ts`:
  - Given a `PaymentIntent` with `path: "direct_arc"`, call
    `sendTokenTransfer` on USDC@Arc.
  - Backend (§5.1) indexes `Transfer(to=treasury, value, …)` and matches on
    `(value, nonce)`. The mobile app does **not** watch the chain — it
    POSTs the tx hash to `takumipay-api /v1/pay/intents/:id/onchain-receipt`
    (server-side endpoint — coordinate spec addition with the backend team)
    and relies on polling + FCM to surface `SETTLED`.
- Update `app/send.tsx` to use the new `sendTokenTransfer` adapter path if
  that migration is still pending — remove any inline `viem.writeContract`
  / `erc20Abi` usage.

## Rules (non-negotiable)

- **USDC interface view = 6 decimals on Arc** (§7). All merchant-math stays
  on the ERC-20 view.
- **No chain-specific code in `/pay-merchant`.** The screen reads
  `intent.path` and calls the executor; executor reads the adapter.
- **Do not watch the chain from mobile.** The backend indexer is the source
  of truth.
- **If `sendTokenTransfer` already exists, do not rename it.** Breaking
  `app/send.tsx` isn't the goal here.

## Acceptance

- [ ] `sendTokenTransfer` on `WalletKitAdapter` exists (added or verified)
      and used from both `app/send.tsx` and the new Path A executor.
- [ ] End-to-end: funded wallet on Arc Testnet → `/pay-merchant` with
      `path: "direct_arc"` → `Transfer` lands on-chain → backend matches →
      `SETTLED` + Xendit fires.
- [ ] No `viem.writeContract` / `erc20Abi` usage remains in `app/send.tsx`.
- [ ] `pnpm check:syntax` + `pnpm lint` pass.

## Out of scope

- `MerchantTreasury.sol` contract deployment (§7 explicitly defers;
  treasury is a platform-owned EOA for v1).
- Arc mainnet addresses (§10.1 migration).
