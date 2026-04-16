# Task 40 — ENS forward + reverse resolution + avatar + CCIP-read

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.5

## Why this matters

ENS names make addresses human-readable. Without resolution, users see raw hex
everywhere — in send flows, history, approval sheets, and the address bar.
This task builds the resolution service that all ENS-consuming features depend on.

## Scope

Create:

- `services/ens/types.ts` — `ENSResolution` type: name, address, avatar,
  textRecords, contenthash, chainId.
- `services/ens/resolver.ts`:
  - `resolveForward(name: string)` — name → address. Uses viem's built-in
    ENS resolution which supports CCIP-read (EIP-3668) natively.
  - `resolveReverse(address: string)` — address → name. Calls `getName` on
    the reverse registrar.
  - `resolveAvatar(name: string)` — fetches avatar record (NFT URI, IPFS, HTTP).
  - `resolveTextRecords(name: string, keys: string[])` — fetch arbitrary text
    records (description, url, twitter, github, etc.).
  - Cache all results in `expo-sqlite` with 24h TTL (ENS names rarely change).
- `services/ens/unstoppable.ts` — Unstoppable Domains (`.crypto`, `.wallet`,
  `.nft`, `.blockchain`) resolution via their Resolution API. Returns same
  `ENSResolution` shape. Not blocking for GA but included in this task as a
  fast-follow adapter.
- `hooks/queries/useENS.ts` — TanStack Query hooks:
  - `useENSName(address)` — reverse resolution.
  - `useENSAddress(name)` — forward resolution.
  - `useENSAvatar(name)` — avatar URL.

## Rules (non-negotiable)

- **CCIP-read must work** — L2-hosted names (Coinbase name service, Linea ENS)
  must resolve. Viem handles this, but verify in tests.
- **Cache is aggressive** — 24h TTL. ENS changes are rare; stale is better than
  slow.
- **No network calls on cache hit.** Return immediately from SQLite.
- **Resolver must not crash on invalid input** — malformed names return `null`.

## Acceptance

- [ ] Forward resolution: `vitalik.eth` → correct address.
- [ ] Reverse resolution: Vitalik's address → `vitalik.eth`.
- [ ] Avatar resolution returns URL for names with avatar set.
- [ ] CCIP-read resolves L2-hosted names (test with a known CB name).
- [ ] Cache stores results and returns them without network calls on subsequent requests.
- [ ] Unstoppable Domains `.crypto` names resolve correctly.
- [ ] `useENSName` / `useENSAddress` hooks work in React components.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- ENS integration in send flow / approval sheets / history (task 41).
- Address bar navigation to ENS contenthash sites (task 41).

## Depends on

- Task 31 (indexer — for cache infrastructure, though ENS uses its own resolution).

## Unblocks

- Task 41 (ENS integration everywhere).
