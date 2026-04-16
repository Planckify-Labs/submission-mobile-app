# Task 48 — Token approval list + revoke + batch revoke + stale detection

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `wallet-features-spec.md` §4.2b

## Why this matters

Users accumulate token approvals (ERC-20, ERC-721, ERC-1155) over time from
dApp interactions. Unlimited approvals are a major attack surface. This task
gives users visibility into their active approvals and the ability to revoke them.

## Scope

Create:

- `services/tokens/approvals.ts` — `TokenApproval` type and helpers:
  - Type: contractAddress, spender, spenderLabel (ENS or known-protocol label),
    allowance (bigint | "unlimited"), tokenType (ERC-20/721/1155),
    isApprovalForAll, chainId, lastUpdatedBlock.
  - `buildRevokeCalldata(approval)` — returns calldata for `approve(spender, 0)`
    (ERC-20) or `setApprovalForAll(operator, false)` (721/1155).
- `hooks/queries/useTokenApprovals.ts` — TanStack Query hook that fetches
  approvals from indexer, grouped by spender.
- `app/settings/approvals.tsx` — approvals management screen:
  - List all active approvals per chain, grouped by spender.
  - Each row: token icon + name, spender (with ENS if available), allowance
    amount ("Unlimited" in red for unlimited), "Revoke" button.
  - Tapping "Revoke" builds `ApprovalIntent<EvmSendTxPayload>` routed through
    `DappBridge` with `origin: "internal://settings"`.
  - **Batch revoke**: checkbox selection → "Revoke Selected" button.
    Builds `wallet_sendCalls` intent (EIP-5792). Smart accounts execute
    atomically; EOAs execute sequentially.
- **Stale approval detection**:
  - On each portfolio refresh, compare current approvals against last known state.
  - New unlimited approvals not initiated by the user (no matching `BridgeEvent`)
    → local push notification: "New unlimited approval detected for [token]
    by [spender]".
  - Store last-known approval state in `expo-sqlite` for comparison.

## Rules (non-negotiable)

- **Revokes go through DappBridge** — same approval sheet, same inspectors.
- **Batch revoke uses EIP-5792** (`wallet_sendCalls`) when available (bridge
  task 16). Falls back to sequential for EOAs without batch support.
- **Stale detection must not false-positive on user-initiated approvals.**
  Cross-reference with `BridgeEventBus` events.
- **"Unlimited" approvals highlighted in red** — this is a security signal.

## Acceptance

- [ ] Approvals screen lists all active approvals per chain.
- [ ] Single revoke builds correct calldata and routes through DappBridge.
- [ ] Batch revoke selects multiple approvals and executes via `wallet_sendCalls`.
- [ ] Stale detection identifies new approvals not initiated by user.
- [ ] Push notification fires for new unlimited approvals.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Approval simulation (future).
- Automatic revocation.

## Depends on

- Task 31 (indexer — for fetching approvals).
- Bridge Phase 1a (`DappBridge.enqueue()`).
- Bridge task 16 (EIP-5792 batch calls) for batch revoke.
- Bridge task 04 (`BridgeEventBus`) for stale detection.
