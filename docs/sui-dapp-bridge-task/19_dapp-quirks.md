# Sui dApp Quirks (Task 19)

**Status:** Scaffold — manual smoke runs to be filled in by the engineer
who flips `FEATURE_SUI_DAPP_BRIDGE` to `true` against a dev WebView on
both iOS and Android.

**Spec reference:** `docs/sui-dapp-bridge-spec.md` §13 task 19.

## Why this doc exists

The Solana rollout taught us that Wallet Standard libraries land
discovery + reconnect patterns that drift in subtle ways across dApps.
Three live Sui dApps cover the breadth of those patterns; documenting
each one's quirks before a public flag-flip prevents the "we shipped to
prod and Suilend doesn't see the wallet on hard-reload" class of
incidents.

The smoke test runs against the dev WebView at `app/dapps-browser.tsx`
with `FEATURE_SUI_DAPP_BRIDGE=true` locally; it does NOT require a prod
build.

## Test matrix

For each dApp + each platform (iOS + Android):

| # | Step | Expected |
|---|---|---|
| 1 | Cold-load the dApp URL | Wallet shows up in the dApp's wallet picker |
| 2 | Click "Connect" | Connect sheet appears; biometric gate fires |
| 3 | Approve | dApp shows your address; account list non-empty |
| 4 | Hard-refresh the page | Silent reconnect succeeds (no sheet) |
| 5 | Sign a `personal_message` | Sign sheet renders SIWS-shaped + UTF-8 preview |
| 6 | Sign a transaction | PTB decoder + simulation panels render |
| 7 | Approve & wait | Effects digest returned to dApp |
| 8 | Disconnect from the dApp | Subsequent silent reconnect returns 4100 |

## dApps under smoke

### Cetus — `https://app.cetus.zone`

**Notable for:** large-volume DEX with PTB-heavy transactions
(SplitCoins → MoveCall × 4 → MergeCoins). Tests the decoder's command
list rendering against complex tx shapes.

| Quirk | Status |
|---|---|
| `getWallets()` listener mounts after hydration → reactive re-discovery | TBD — verify `app-ready` covers |
| Uses `signTransactionBlock` (legacy) on some routes | TBD |
| Refreshes wallet list on `accountChanged` | TBD |

### Suilend — `https://suilend.fi`

**Notable for:** lending UI with SIWS for session auth. Tests the SIWS
inspector + sheet's domain-pin warning surface.

| Quirk | Status |
|---|---|
| SIWS message includes a custom `Resources:` list | TBD |
| Switches network mid-session via `takumi:switchNetwork` | TBD — N/A unless we surface picker |
| Calls `sui:reportTransactionEffects` for cache invalidation | TBD — adapter returns `{ ok: true }` |

### Navi — `https://app.navi.com`

**Notable for:** DeFi aggregator with sponsored-tx flows
(`gasOwner !== sender`). Tests the sponsored-tx annotation path.

| Quirk | Status |
|---|---|
| Sponsored-tx renders with `Sponsored by 0x…` chip | TBD |
| Uses `sui:signAndExecuteTransactionBlock` (legacy alias) on at least one route | TBD |
| Throws on first-tx if simulation inspector blocks the flow | TBD |

## What to write back into this doc

For each row above, replace `TBD` with one of:

- `OK — <one-line note>`: behaviour matches expectation.
- `WORKAROUND — <PR / commit ref>`: required a code change; link the diff.
- `KNOWN — <issue ref>`: tolerated quirk; no action this milestone.

Do NOT silently pass on a row — every row gets explicit attention before
Task 20 (flag flip) merges. The post-mortem template
`docs/wallet-security-task/README.md` describes why.

## Out of scope

- Any dApp not in the three above. Future milestones add a broader
  matrix; this is the smallest set that exercises every spec §4 / §5
  branch.
- Stress testing (concurrent sessions, network flapping). Filed as
  follow-up.
