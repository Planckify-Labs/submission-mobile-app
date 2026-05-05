# Task 11 — `SuiTransactionSheet.tsx` (sign-only + sign-and-execute)

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §7.1 (table row), §8 (annotations to render).

## Why this matters

The transaction sheet is the only chance to show the user a decoded PTB
+ simulation outcome before they sign. A decision to merge
sign-only and sign-and-execute into one component (with a `mode` flag
toggling button label and post-action behavior) avoids two near-identical
sheets drifting from each other.

## Scope

- `components/dapps-browser/approvals/SuiTransactionSheet.tsx`:
  - Reads `intent.payload: SuiSignTxPayload`.
  - Renders:
    - Origin row (host, title) — reuse the shared origin chip already
      used by Solana sheets.
    - Network chip (`Sui · Mainnet/Testnet/Devnet`).
    - Decoded PTB list (`payload.decoded`) — one row per
      `SuiDecodedCommand`. MoveCall rows show
      `0x<package>::<module>::<function>` with copy-button on the package id.
    - Gas summary card — `gasBudget`, `gasPrice`, `gasOwner` (annotated
      "sponsored by 0x..." when `gasOwner !== sender`).
    - Simulation summary card (`payload.simulation`) — balance changes,
      object changes, status. Hidden when `simulation.failed` annotation
      present, replaced with degraded-state banner.
    - Warnings panel — render every annotation from the intent grouped
      by severity (danger > warn > info). Reuse `RiskBanner` component.
    - Action button — `Sign` (mode=sign-only) | `Sign & Execute`
      (mode=sign-and-execute). Both call the same approval-confirm
      handler; the adapter dispatches on payload.mode.
- Snapshot tests with three fixtures:
  1. Sign-only MoveCall, decoder output present, simulation success.
  2. Sign-and-execute TransferObjects, danger annotation
     (`object.delete`), warn annotation (`ownership.transfer-out`).
  3. Sponsored tx (gasOwner ≠ sender) with sponsor annotation visible.

## Rules (non-negotiable)

- **One sheet, two modes.** Don't split into two components. The §3.1
  `SuiSignAndExecuteSheet.tsx` row notes "may collapse" — collapse it.
- **Simulation degradation is non-blocking.** When simulation fails or
  times out, show a warning band but do NOT disable the Sign button.
  The user signed before simulation existed; we don't take consent
  away when our optional inspector is unhealthy.
- **No raw bytes shown by default.** A "show raw bytes" disclosure
  exposes `payload.transaction` for power users; default-collapsed.
- **Foreign-package package ids are copyable** (annotation
  `move-call.foreign-package` from Task 08).
- **Match Solana sheet typography / spacing primitives** — pull from the
  same shared sheet primitives used by `SolanaTransactionSheet.tsx`.

## Acceptance

- [ ] Three snapshot fixtures green.
- [ ] Sponsor annotation visible for `gasOwner !== sender`.
- [ ] Degraded-simulation banner reachable via fixture.
- [ ] `pnpm check:syntax` passes; `pnpm biome:check` clean.

## Out of scope

- Renderer registration (Task 13).
- Sponsored-transaction sponsor-side renderer (out of milestone per §0).
