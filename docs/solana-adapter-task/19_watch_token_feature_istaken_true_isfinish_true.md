# Task 19 — `takumi:watchToken` + `SolanaWatchTokenSheet`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.7, §10.1.

## Why this matters

`wallet_watchAsset` has no Solana analog — dApps (Jupiter after a
new token import, pump.fun after a launch) can't tell the wallet
"remember this mint." We ship a custom `takumi:watchToken` feature
that mirrors the EVM `WatchAssetSheet` UX but verifies on-chain
metadata server-side so dApps can't spoof name/decimals.

## Scope

- `components/dapps-browser/approvals/SolanaWatchTokenSheet.tsx`:
  - Two-column rows — "dApp says" vs "On-chain" for
    `symbol`, `name`, `decimals`, `image`.
  - Mismatches styled as `warn`; matches muted.
  - Token-2022 extension section when `verified.mintOwner ===
    "token-2022"` — shows every extension from Task 14 with its
    severity class.
  - Approve / Reject.
- `services/chains/solana/SolanaAdapter.ts::makeWatchTokenIntent`:
  - Reads mint via `rpc.getAccountInfo(mint)` (parsed).
  - Populates `verified.mintOwner` (spl-token vs token-2022) and
    `verified.extensions` (from Task 14's parser).
  - Never trusts dApp-supplied `decimals`, `symbol`, etc. — these go
    in the payload alongside the verified values for diffing.
- `executeApproval` for `ApprovalKind="watchAsset"` +
  `namespace="solana"`:
  - Writes to `services/tokens/tokenList.ts` under the Solana
    namespace (existing per `solana-chain-support-spec.md` §3.1).
  - The home screen's `useGroupedTokenBalances` picks it up.
- Injected script exposes feature:
  ```ts
  "takumi:watchToken": {
    version: "1.0.0",
    watchToken: async (mint: string, hint?) => { … },
  }
  ```
- `bridge/renderers.ts` — register for `(kind: "watchAsset",
  namespace: "solana")`.

## Rules (non-negotiable)

- **Never trust dApp metadata.** Always re-fetch on-chain; render
  mismatches as `warn`.
- **Token-2022 extensions surface every time.** Invariant 8 —
  same severity rules as Task 14.
- **No write without on-chain confirmation.** If
  `getAccountInfo(mint)` fails, reject `-32603 "mint unreadable"`;
  do not persist the dApp hint alone.

## Acceptance

- [ ] Fixture mint with on-chain metadata: sheet shows "On-chain"
      column populated.
- [ ] dApp supplies wrong decimals → `warn` visual.
- [ ] Approved mint appears in home-screen token list.
- [ ] Token-2022 mint with `TransferFee` → extension row visible.

## Out of scope

- cNFT watch (deferred per §9 / `solana-chain-support-spec` N5).
- Automatic balance indexing (separate indexer spec).
