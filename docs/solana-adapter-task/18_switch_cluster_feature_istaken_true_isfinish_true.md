# Task 18 — `takumi:switchCluster` + sheet + `standard:events change`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.5, §10.1, §10.4 inv 16.

## Why this matters

Solana has no EIP-3326. Without a defined switch convention, any dApp
asking the user to move from mainnet to devnet has no standard way to
prompt. We ship `takumi:` namespaced custom feature (spec-compliant —
`takumi:` is not reserved) so both dApp-invoked and app-UI-invoked
cluster switches land in the same flow with a user sheet.

## Scope

- `components/dapps-browser/approvals/SolanaSwitchClusterSheet.tsx`:
  - Renders origin, current cluster, target cluster, wallet, what
    changes (RPC URL, grant scope).
  - Approve / Reject.
- `services/chains/solana/SolanaAdapter.ts::makeSwitchClusterIntent`
  builds a `SolanaSwitchClusterPayload { from, to }`.
- `executeApproval` for `ApprovalKind="switchCluster"`:
  - Calls `ctx.setActiveChain(solanaChainConfig(to))` — already
    threaded via `bootBridge`.
  - **Does NOT** emit `standard:events change` with a narrowed
    `chains: [...]` — invariant 16. `Wallet.chains` remains the full
    set post-boot.
  - Emits `standard:events change` with `accounts: [updated account
    object]` **only if** a grant exists for `(origin, wallet, to)`.
    Otherwise the dApp sees `accounts: []` — must call
    `standard:connect` fresh to get the new-cluster grant.
- Injected script exposes the feature in the `features` map:
  ```ts
  "takumi:switchCluster": {
    version: "1.0.0",
    switchCluster: async (to: SolanaCluster) => { … },
  }
  ```
- **App-UI path** — the in-app cluster picker calls the same feature
  so user-initiated switches route through the same sheet, via
  `bridge_request` transport. (A single code path for both.)
- `bridge/renderers.ts` — register for `(kind: "switchCluster",
  namespace: "solana")`.

## Rules (non-negotiable)

- **No `Wallet.chains` narrowing.** Invariant 16. Firing `{chains:
  [...narrowed]}` makes dApps think we dropped support for the old
  cluster.
- **Cluster-scoped grants.** Post-switch, `accounts` in the change
  event reflects whether a grant exists for the **new** cluster — it
  doesn't imply revoke of the old cluster's grant.
- **No silent switch from a signing call.** If a dApp signs on a
  cluster the user isn't on, adapter rejects `4901` (Task 04) — the
  dApp then calls `takumi:switchCluster` explicitly.
- **Single sheet, single code path.** App UI and dApp UI route
  through the same feature.

## Acceptance

- [ ] Phantom's faucet demo switches mainnet → devnet via the sheet;
      subsequent signing on devnet works.
- [ ] Post-switch `standard:events change` fired with `accounts:
      [newAccount]` if grant exists.
- [ ] `Wallet.chains` identical before/after switch (unit test).
- [ ] App-UI switch from cluster picker reuses the same sheet.
- [ ] Reject path returns `4001`.

## Out of scope

- Per-request cluster routing (done in Tasks 04, 05).
- Solana Pay URI routing (deferred — see §9).
