# Task 06 — Widen `PermissionGrant.chainId` + Solana key tuple

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.10 port fit, §6 Phase 1b, §8 Q1, §10.4 inv 15.

## Why this matters

`services/permissions/store.ts:7-17` declares `PermissionGrant.chainId:
number` — EVM-only. Every Solana grant would silently collapse to `0`
or trip type errors. §4.5 also mandates cluster-scoped grants so
`takumi:switchCluster` can revoke the origin's mainnet auth without
touching its devnet auth. The widening is a one-migration-on-boot
change that unblocks Tasks 07 (Connect sheet writes the grant), 18
(switchCluster), and the silent-connect invariant.

## Scope

- `services/permissions/store.ts`:
  - Widen `PermissionGrant.chainId` to `string | number`.
  - Add `namespace: "eip155" | "solana"` (optional for backward-compat;
    inferred on migration).
  - New primary key: `(originHash, walletAddress, chainId)` — the
    chainId string carries CAIP-2 cluster for Solana (e.g.
    `"solana:mainnet"`), numeric EVM chain ID remains for EVM.
  - Migration IIFE on boot — every existing EVM grant backfilled with
    `namespace: "eip155"`; no disk mutation for users who never signed
    in before.
- **Accessor helpers:**
  - `getGrant(origin, wallet, chain)` where `chain` is a
    `ChainConfig` — picks the `chainId` shape automatically
    (`chain.namespace === "solana" ? chain.caip2 : chain.chainId`).
  - `setGrant(origin, wallet, chain)` — same dispatch.
  - `revokeGrant(origin, wallet, chain)` — removes only the
    cluster-scoped grant, not the whole origin.
- **`app/settings/dapp-permissions.tsx`** — groups grants by
  `(origin, namespace)` so users see "`jupiter.ag` — Solana mainnet"
  distinct from "`jupiter.ag` — Ethereum". Tap to revoke.
- **Tests** — migration fixture + per-namespace set/get/revoke.

## Rules (non-negotiable)

- **One grant shape across namespaces.** Do NOT fork
  `SolanaPermissionGrant` — polymorphism at the type level, not in
  storage.
- **Migration is additive.** No existing EVM grants are invalidated.
  Silent-connect for returning EVM users must still work post-upgrade.
- **Cluster is part of the key.** A grant for `solana:mainnet` does
  not imply `solana:devnet` — they are distinct permissions.
  Invariant §4.5 consequence.
- **`silent: true` reads `getGrant`, not any other store.** The only
  source of truth for "has the user approved this origin on this
  cluster" is `PermissionStore`.

## Acceptance

- [ ] `pnpm check:syntax` passes across the whole bridge layer.
- [ ] Migration test: old EVM grant shape → post-migration record with
      `namespace: "eip155"`, same `originHash`, same numeric chainId.
- [ ] Unit test: `setGrant(origin, wallet, mainnetChainConfig)` then
      `getGrant(origin, wallet, devnetChainConfig)` returns
      `undefined`.
- [ ] Settings screen renders both namespaces distinctly.

## Out of scope

- Consuming grants in the Connect sheet (Task 07).
- `takumi:switchCluster` grant mutation (Task 18).
