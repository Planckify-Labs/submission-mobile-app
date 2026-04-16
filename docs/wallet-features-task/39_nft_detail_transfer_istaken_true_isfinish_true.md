# Task 39 — NFT detail screen + send NFT flow + ERC-6551 TBA detection

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.3

## Why this matters

Users need to view NFT details (traits, floor price, full-res media) and
transfer NFTs to other addresses. ERC-6551 token-bound accounts are increasingly
common and should be surfaced when detected.

## Scope

Create:

- `components/nft/NFTDetail.tsx` — detail screen:
  - Full-res image/video display (video via `expo-av` or `expo-video`).
  - Traits grid (attribute name + value, display type formatting).
  - Collection info: name, floor price, verified status.
  - Chain badge.
  - "Transfer" button → opens send NFT flow.
  - "View on marketplace" deep link (OpenSea, etc.).
- `components/nft/TBABadge.tsx` — "This NFT owns assets" badge:
  - Detect token-bound accounts via ERC-6551 registry
    (`0x000000006551c19487814612e58FE06813775758`).
  - Call `account(implementation, salt, chainId, tokenContract, tokenId)` to
    derive the TBA address.
  - Check if TBA has non-zero balance → show badge.
  - Tap badge → show TBA's portfolio inline (token balances via indexer).
- Send NFT flow:
  - Recipient input (address or ENS — basic for now, full ENS in task 41).
  - Builds `ApprovalIntent<EvmSendTxPayload>` for `safeTransferFrom` (ERC-721)
    or `safeTransferFrom(from, to, id, amount, data)` (ERC-1155 with amount selector).
  - Routed through `DappBridge` with `origin: "internal://nft-gallery"`.
  - Approval sheet shows NFT image + name, not just raw calldata.

## Rules (non-negotiable)

- **NFT transfers go through DappBridge** — same approval flow as any tx.
- **ERC-1155 amount selector** for semi-fungible tokens (user owns N, choose how many to send).
- **TBA detection is optional display** — if the registry call fails, just don't show the badge.
- **Video/animation** support is best-effort — display static image if playback fails.

## Acceptance

- [ ] NFT detail screen shows full metadata, traits, collection info.
- [ ] Video NFTs play inline.
- [ ] Transfer flow builds correct `safeTransferFrom` calldata for 721 and 1155.
- [ ] ERC-1155 amount selector works for tokens with balance > 1.
- [ ] TBA badge appears when NFT has a token-bound account with assets.
- [ ] Transfer routes through `DappBridge` approval flow.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Marketplace listing/buying (out of scope for v1).
- Full TBA management (sending from TBA).

## Depends on

- Task 38 (NFT gallery).
- Bridge Phase 1a (`DappBridge.enqueue()`).
