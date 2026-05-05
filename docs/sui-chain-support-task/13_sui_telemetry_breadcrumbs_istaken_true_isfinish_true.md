# Task 13 — Sentry tags `chain=sui` + breadcrumbs (no key bytes)

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-chain-support-spec.md` §10 (row 12), §6.

## Why this matters

The Solana rollout discovered failure modes (RPC rate-limits, regression
in fee estimation, address-book validation regressions) only because
Sentry tagged events with `chain=solana` and breadcrumbs surfaced the
sequence. Sui needs the same treatment from day one; without it, the
first wave of user reports comes in as un-correlatable strings. This
task adds the chain tag + breadcrumb plumbing **without leaking secret
material** — the bug class TWV-2026-XXX guards.

## Scope

- `services/sentry.ts` (or wherever the chain tag is set on the active
  scope — grep for `chain=solana` to find it):
  - Extend the active-chain tag updater to set `chain=sui` when
    `activeChain.namespace === "sui"`.
  - Extend the active-network tag (`network=mainnet|testnet|devnet`)
    to read from `activeChain.network` for the Sui arm.
- Add breadcrumbs at the same call sites Solana adds them:
  - `SuiWalletKit.sendNativeTransfer` start/success/failure.
  - `SuiWalletKit.sendTokenTransfer` start/success/failure with
    `tokenKind` discriminator (Coin / Regulated / Closed-Loop) — but
    NEVER the `coinType` if the user hasn't shipped it explicitly via
    public token-list metadata (treat user-pasted CoinTypes as PII).
  - `detectSuiTokenKind` cache miss / error.
  - `getSuiSignerForWallet` "derivation failed" only — the existing
    Solana breadcrumb pattern.
- Sentry context for typed errors (Task 07): `errorName` field carries
  the class name; the typed error's public properties (e.g.
  `denyListId`, `tokenPolicyId`) are safe to attach.

## Rules (non-negotiable)

- **NEVER log secret material.** No `seed`, `privateKey`, `mnemonic`,
  `pubkey`, or any byte of them. No `signer` object reference. No
  intermediate `Uint8Array` from the dwell site.
- **Treat user-pasted CoinTypes as PII.** A custom-loyalty-token
  CoinType identifies the loyalty program and possibly the user's
  membership. Only attach CoinTypes that come from the public API
  token list (where the user opted into a curated row).
- **No new Sentry transport / DSN.** Reuse the existing initialised
  client; this is purely a tag + breadcrumb extension.
- **Breadcrumb levels.** `info` for start/success, `error` for
  failures. `warning` reserved for retry / fallback paths (none in
  v1, but reserve the level).

## Acceptance

- [ ] `chain=sui` tag set on Sentry scope when `activeChain.namespace
      === "sui"`.
- [ ] `network` tag reflects mainnet / testnet / devnet.
- [ ] Breadcrumbs attached at the four call sites above.
- [ ] Manual smoke: trigger a `send_sui` failure (e.g. invalid
      recipient) and confirm the Sentry event carries
      `chain=sui`, `network=mainnet`, and a `sendNativeTransfer`
      breadcrumb chain — without any byte of secret material.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Custom dashboards in Sentry — coordinate with the observability
  team via a separate ticket.
- Performance tracing — out of scope for v1.
- DApp-bridge breadcrumbs — added in the follow-up spec.
