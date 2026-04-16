# Task 38 — NFT gallery: indexer integration + grid UI + metadata resolution

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.3

## Why this matters

Users hold NFTs but have no way to view them in-app. This task builds the
NFT data layer and gallery UI — grid view grouped by collection with metadata
resolution and spam filtering.

## Scope

Create:

- `services/nfts/types.ts` — `NFTAsset` and `NFTAttribute` types from spec §4.3.
  Includes collection info (name, slug, imageUrl, isVerified, floorPrice),
  metadata (name, description, imageUrl, animationUrl, attributes), balance,
  chainId, isSpam.
- `services/nfts/metadataResolver.ts` — metadata resolution chain:
  1. Indexer response (primary).
  2. `tokenURI` on-chain call (fallback).
  3. IPFS gateway resolution (pinata → cloudflare-ipfs → w3s.link).
  4. Arweave gateway.
  Cache resolved metadata in `expo-sqlite` + file system for images.
- `services/nfts/spamFilter.ts` — NFT spam heuristics:
  - Indexer-side spam flag passthrough.
  - Known airdrop-scam collection list (bundled, updated via remote config).
  - Hidden NFTs go to "Hidden" tab, not deleted — user can restore.
- `hooks/queries/useNFTs.ts` — TanStack Query hook with pagination. Returns
  NFTs grouped by collection.
- `components/nft/NFTGrid.tsx` — grid view: collection headers, NFT thumbnails,
  spam badge overlay. Tap navigates to detail (task 39).
- `components/nft/CollectionHeader.tsx` — collection name, verified badge,
  floor price, count.
- `app/(tabs)/nfts.tsx` — NFT tab screen with grid + "Hidden" tab toggle.

## Rules (non-negotiable)

- **IPFS gateway fallback chain** must try multiple gateways — single gateway
  is unreliable.
- **Image caching**: use `expo-file-system` for downloaded images, not just
  in-memory. NFT images are large; re-downloading is expensive.
- **Spam NFTs default to hidden** but are accessible via the "Hidden" tab.
- **Pagination**: fetch 20 NFTs per page, infinite scroll.

## Acceptance

- [ ] NFTs fetched from indexer and displayed in grid grouped by collection.
- [ ] Metadata resolver falls through: indexer → tokenURI → IPFS → Arweave.
- [ ] Images cached to file system.
- [ ] Spam NFTs hidden by default, visible in "Hidden" tab.
- [ ] Collection headers show name, verified badge, floor price.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- NFT detail screen + transfer flow (task 39).
- ERC-6551 TBA detection (task 39).

## Depends on

- Task 31 (indexer abstraction).

## Unblocks

- Task 39 (NFT detail + transfer).
