# Task 15 — `setApprovalForAll` red-flag UI + revoke screen

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-009, §7, §9

## Why this matters

`setApprovalForAll(operator, true)` grants an operator the right to move every
current and future NFT a wallet holds in a collection — the "Ice Phishing"
class that drives Monkey/Venom/Inferno drainers. Today the mobile signer can
render this selector as a generic "Contract Interaction" because
`services/decoders/calldata.ts` does not raise it to a distinct banner, and
the app has no first-class "Approvals" screen for one-click revoke. Users
approve a drain in two taps.

## Scope

- `services/decoders/calldata.ts` — add a dedicated decoder branch for ERC-721
  / ERC-1155 `setApprovalForAll(operator, approved)` that returns a typed
  result the signer UI can discriminate on (not a generic function call).
- `services/decoders/calldata.ts` — add an `erc20.approve(spender, amount)`
  branch that flags `amount >= type(uint256).max / 2` as "unlimited".
- Signer UI (the screen that renders the decoded payload before signing,
  under `components/` — see spec §7 for the non-regression list) — render a
  red banner for the two cases above with the operator address, collection
  name (resolve via `services/nfts/` if available), and the canonical warning
  text from §6 TWV-2026-009.
- New route `app/settings/approvals.tsx` (an "Approvals" screen) listing all
  outstanding ERC-20 / ERC-721 / ERC-1155 approvals for the active wallet on
  the active chain, read via `services/indexer/` (see spec §9 — build revoke
  list from indexer). Each row has a one-tap "Revoke" that builds the zero /
  `setApprovalForAll(operator, false)` tx and routes it through the existing
  signer.

## Rules (non-negotiable)

- The decoder MUST identify `setApprovalForAll` and unlimited `approve` as
  distinct result variants — not as strings inside a generic payload.
- The red banner MUST name the operator contract and state explicitly that
  "this gives CONTRACT permission to move ALL your NFTs in COLLECTION".
- The Approvals screen MUST NOT cache revoke results — a revoke is only
  "done" when the on-chain tx is mined, not when the user taps.
- No change in behaviour for payloads that are not `setApprovalForAll` or
  `approve` — §7 parity.

## Acceptance

- [ ] Decoder unit tests cover `setApprovalForAll(true)`, `setApprovalForAll(false)`,
      `approve(uint256.max)`, `approve(small)`, and non-approval calldata.
- [ ] Signing a `setApprovalForAll(true)` payload renders the red banner and
      requires a distinct confirm action (not the default "Sign" primary).
- [ ] `app/settings/approvals.tsx` lists outstanding approvals and can
      submit a revoke tx that clears the row once mined.
- [ ] Regression: existing ERC-20 `transfer` / `transferFrom` / swap flows
      render unchanged.
- [ ] pnpm check:syntax passes.

## Out of scope

- Simulation-driven asset-delta display (task 17, TWV-2026-011).
- Risk-engine reputation scoring (Blockaid / GoPlus) — §8 Phase 3.
- Batch-revoke across multiple collections in a single session.
