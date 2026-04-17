# Task 07 — `SolanaConnectSheet` + `{ silent: true }` semantics

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.2, §6 Phase 1a, §10.1, §10.4 inv 15.

## Why this matters

Today the Solana path re-uses `ConnectSheet` (EVM chrome, chainId pill,
wrong cluster copy). A real Solana connect sheet is the last thing
blocking Phase 1a exit — once it lands, Phantom's demo site connects
cleanly, and silent-connect `useEffect` flows on Jupiter / Drift stop
falsely surfacing modals.

## Scope

- `components/dapps-browser/approvals/SolanaConnectSheet.tsx`:
  - Renders origin, favicon, cluster pill (`mainnet-beta | devnet |
    testnet`), active Solana wallet row, "Approve" / "Reject".
  - On approve: writes a `PermissionGrant` keyed by `(originHash,
    walletAddress, "solana:<cluster>")` via Task 06 accessor.
  - On reject: resolves with `ChainResult.error(4001)`.
- `SolanaAdapter.executeApproval` — `ApprovalKind="connect"` with
  `namespace==="solana"` → build response `{ accounts: [walletAccount] }`
  where `walletAccount` has `publicKey: Uint8Array(32)` (invariant 13).
  Response propagates to the injected script which hands dApps the
  typed-array shape.
- **Silent-connect flow** (`standard:connect({ silent: true })`) —
  **no sheet**. `SolanaAdapter.handleRequest`:
  1. `getGrant(origin, activeWallet, cluster)` → if present, return
     `ChainResult.resolved({ accounts: [walletAccount] })` immediately.
  2. Otherwise → `ChainResult.error(4100)` — never `needs-approval`.
- `services/chains/solana/payloads.ts::SolanaConnectPayload.onlyIfTrusted`
  carried through `handleRequest` and read in `executeApproval` for
  the silent branch.
- `bridge/renderers.ts` — register `SolanaConnectSheet` for
  `(kind: "connect", namespace: "solana")`.

## Rules (non-negotiable)

- **`silent: true` never opens a sheet.** Invariant 15. This is a
  `useEffect`-path used by Jupiter's page-load restore; surfacing a
  modal breaks the dApp's assumption that an error is immediate.
- **`publicKey` returned to the WebView is `Uint8Array(32)`, not
  base58.** The injected script translates to base58 for
  `walletAccount.address`; `publicKey` stays raw bytes. Invariant 13.
- **Cluster-scoped grant write.** The Connect sheet writes exactly
  one grant for the current cluster. Switching cluster later uses
  `takumi:switchCluster` (Task 18) to write an additional grant.
- **No EVM `chainId` fallback.** Sheet must never show a numeric
  chainId pill — only the Solana cluster name.

## Acceptance

- [ ] Phantom's Wallet Standard demo connects via TakumiAI without a
      manual adapter; wallet name visible in its picker.
- [ ] Approve path writes the grant; re-connect same origin / same
      cluster with `silent: true` resolves without sheet.
- [ ] Reject path returns `4001`.
- [ ] Devnet-first dApp switching to mainnet via reconnect re-opens
      the sheet (no grant for mainnet yet).
- [ ] Snapshot test of the sheet renders with and without favicon.

## Out of scope

- `takumi:switchCluster` flow (Task 18).
- `standard:events` change emission on wallet switch (Task 18).
