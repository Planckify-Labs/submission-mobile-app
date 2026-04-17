# Task 04 — `SolanaAdapter.handleRequest` routing table

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.1, §4.5, §6 Phase 1a, §10.1.

## Why this matters

Today `handleRequest` uses Solana-specific method names
(`"solana:standard:connect"`) that won't match what the Wallet
Standard script in Task 03 writes. Renaming to real WS identifiers is
a hard Phase 1a prerequisite. Same commit splits the overloaded
`"signTransaction"` into separate sign-only and sign-and-send intents
so `ApprovalKind` can route them to different sheets.

## Scope

- `services/chains/solana/SolanaAdapter.ts::handleRequest(req, ctx)`
  implements the §4.1 switch:
  - `standard:connect` → `makeConnectIntent`.
  - `standard:disconnect` → resolved `null`.
  - `solana:signIn` → `makeSignInIntent`.
  - `solana:signMessage` → `makeSignMessageIntent`.
  - `solana:signTransaction` with N=1 → `makeSignTxIntent(…, "sign-only")`.
  - `solana:signTransaction` with N>1 → `makeSignAllIntent` (kind
    `"signAllTransactions"` on the internal side; feature is still
    variadic on wire).
  - `solana:signAndSendTransaction` → `makeSignTxIntent(…, "sign-and-send")`.
  - `takumi:switchCluster` → `makeSwitchClusterIntent`.
  - `takumi:watchToken` → `makeWatchTokenIntent`.
  - default → `ChainResult.error(4200)`.
- **Legacy alias** — keep `"solana:standard:connect"` routing to
  `standard:connect` for one release with a `console.warn`.
- **`pickSolanaWallet(ctx, req)`** — throws `4100` if no active Solana
  wallet; uses active wallet only (never iterates).
- **`resolveCluster(req, ctx)`** — reads `req.params.chain` via
  `canonicalizeChain` (Task 02); falls back to `ctx.activeChain` when
  omitted; throws `-32602` on malformed. For signing calls where
  requested cluster ≠ active wallet cluster, return
  `ChainResult.error(4901 "cluster not connected")` per §4.5 step 4
  — no silent switch.
- **Silent connect** — `standard:connect({silent:true})` reads
  `getGrant`: grant present → `ChainResult.resolved({accounts:[…]})`;
  no grant → `ChainResult.error(4100)`. Never `needs-approval`.

## Rules (non-negotiable)

- **No `4902`.** Solana has no "add chain" — all clusters are
  compile-time known. Use `4901` when a dApp targets an unconnected
  cluster.
- **No silent cluster switch.** Reject `4901` — let the dApp prompt.
- **Every branch returns a `ChainResult`.** No `throw` escapes
  `handleRequest`.
- **`silent: true` never opens a sheet.** Invariant 15.

## Acceptance

- [ ] Each §10.1 row routes correctly — unit test per branch.
- [ ] `silent: true` resolves-with-grant / rejects-`4100`-without.
- [ ] Cross-cluster signing call → `4901`.
- [ ] Legacy alias still resolves with warn.

## Out of scope

- `executeApproval` per-feature (Tasks 09, 16, 17, 18, 19, 20).
- Inspector pipeline (Tasks 10–14).
- Sheets (Tasks 07, 15–19).
