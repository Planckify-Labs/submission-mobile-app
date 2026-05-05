# Task 21 — Extend `caip2ToNamespace` for `sui:`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §3.2 (caipMapping row).

## Why this matters

The reverse direction (`namespace → caip2`) at `caipMapping.ts:35-39`
already handles Sui. The forward direction (`caip2 → namespace`) at
`:11-23` does not. The bridge does not call this — but agent permissions
might, and any future WalletConnect-over-Sui spec absolutely will. Land
the symmetric mapping now while it's a one-line change.

## Scope

- `services/walletconnect/caipMapping.ts:11-23`: extend
  `caip2ToNamespace` to recognise `sui:` (currently only `eip155:` and
  `solana:` map there).
- Add unit test asserting both directions round-trip for `sui:mainnet`,
  `sui:testnet`, `sui:devnet`.

## Rules (non-negotiable)

- **Strictly orthogonal.** No other behavior change. This is a
  one-function patch.
- **Symmetric with the reverse direction.** If `:35-39` maps
  `"sui" → "sui:..."`, then `:11-23` must map `"sui:..." → "sui"`.
- **No WalletConnect implementation.** That's a separate spec (out of
  scope per §0).

## Acceptance

- [ ] One-line patch in `caip2ToNamespace`.
- [ ] Round-trip test green for all three Sui networks.
- [ ] EVM / Solana mappings unchanged.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- WalletConnect-over-Sui — separate spec.
- Bridge-side use (the bridge does not call `caip2ToNamespace`).
