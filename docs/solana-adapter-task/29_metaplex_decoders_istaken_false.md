# Task 29 — Metaplex Token Metadata / Core / Bubblegum decoders

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §6 Phase 1c, §10.2.

## Why this matters

Magic Eden listings, Tensor bids, mint pages all emit Metaplex
instructions. Decoding Transfer / Update / Burn / Delegate / Revoke
lets the sheet say "Transfer NFT {name} to {recipient}" instead of
opaque Metaplex program data. Covers classic Token Metadata, the
newer Core standard, and Bubblegum for cNFT instructions.

## Scope

- `services/chains/solana/programDecoder.ts` — three new branches:
  - **Token Metadata** (`metaqbxx…`): Create, Update, Transfer, Burn,
    Delegate, Revoke, Lock, Unlock.
  - **Metaplex Core** (`CoREzp9…`): Create, Transfer, Update, Burn.
  - **Bubblegum** (`BGUMAp9…`) for cNFTs: MintV1, Transfer, Delegate,
    Burn, Redeem.
- For every decoded Transfer: surface the `{ program, kind: "transfer",
  data: { from, to, asset? } }` with asset name when resolvable.
- **Danger rules:**
  - `Delegate` (any of the three programs) → `warn: "Delegate
    authority for NFT {asset} to {delegate}"`.
  - Burn when signer is the owner → `info` (user-initiated).
  - Burn when signer is a delegate → `danger` (potential scam
    pattern).
- **Asset-name resolution** — when `asset` / `mint` is provided in
  the instruction, read on-chain metadata lazily via
  `rpc.getAccountInfo` through `solanaRpcPool`; if unresolvable, show
  base58 only (never invent names).

## Rules (non-negotiable)

- **Invariant 23 fallback.** Unknown Metaplex-program instruction →
  `{ kind: "unknown" }`, never silently hidden.
- **Asset name is advisory.** If the on-chain metadata can't be
  fetched in the 2 s inspector budget, show the mint address only —
  do not block approval.
- **cNFT balance display is out of scope.** Bubblegum decode here is
  instructions-only; balance / ownership reads are gated on the
  indexer (separate spec).

## Acceptance

- [ ] Token Metadata transfer fixture → readable summary.
- [ ] Core transfer fixture → readable summary.
- [ ] Bubblegum Transfer + `takumi.sol` recipient (via Task 30)
      fixture → "Transfer cNFT {asset} to takumi.sol → {base58}".
- [ ] Delegate fixture → warn annotation.
- [ ] Manual smoke: MagicEden listing flow reads naturally in sheet.

## Out of scope

- cNFT balance display (indexer spec).
- Full Metaplex Inscription / Compressed-State NFT support.
