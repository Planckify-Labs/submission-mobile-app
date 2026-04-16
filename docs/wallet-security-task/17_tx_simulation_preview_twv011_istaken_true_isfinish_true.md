# Task 17 — Pre-sign transaction simulation + asset-delta display

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-011, §7, §9

## Why this matters

Radiant Capital (~$50M, Oct 2024) shipped because the Safe UI showed a
routine transfer while the actual calldata was `transferOwnership(attacker)`
and the Ledger screen could not parse it. The wallet was blind. TakumiAI
already ships `services/agent-executors/simulate.ts`, but the spec's
applicability note (§6 TWV-2026-011) calls out that it must run before
**every** user-signed and agent-signed transaction, and the signer UI must
block on simulator error. Today the hook is not wired into the user signing
path, and asset-delta is not the primary UX element.

## Scope

- `services/agent-executors/simulate.ts` — export a stable simulation API
  usable from both the agent path and the user-signer path (today it is
  agent-internal per its folder). Must return typed asset deltas
  (ETH / ERC-20 / ERC-721 / ERC-1155, net in/out per token) and a decoded
  call tree (top-level + internal calls, including `multicall` and Safe
  `execTransaction`).
- Signing path — before `signTransaction` / `sendTransaction`, invoke the
  simulator against a pinned RPC (see task 23, TWV-2026-026). Render the
  asset-delta as the primary UX element on the confirm screen. The raw
  calldata / function name is secondary.
- Failure policy — if the simulator errors (network, revert, unsupported
  chain), the signer UI blocks the signature with an explicit "Simulation
  failed — cannot verify this transaction" message. The user may opt in to
  sign anyway only via a distinct "Sign without simulation" action, not the
  default primary button.
- Safe multisig — when the tx target is a Safe or the payload is
  `execTransaction`, also fetch the Safe tx hash from the Safe Transaction
  Service (task 25 will do the full re-derive; this task only wires the
  asset-delta display). See spec §9.

## Rules (non-negotiable)

- The simulator result MUST come from a **pinned** RPC, not the dApp-supplied
  one. Trusting the dApp's RPC defeats the control (Bybit-class, see
  TWV-2026-033).
- The asset-delta block MUST be rendered above and larger than the decoded
  calldata on the confirm screen.
- Simulation error MUST NOT silently fall through to signing. Default UX is
  block.
- The user-signer path and the agent-signer path MUST call the same
  simulation function — parity (§7 agent-behaviour parity).

## Acceptance

- [ ] `services/agent-executors/simulate.ts` exposes a public `simulate(tx,
      chainId)` callable from the user signing flow.
- [ ] Every user-signed and agent-signed tx invokes the simulator before the
      confirm screen renders.
- [ ] Confirm screen shows asset-delta rows (symbol, direction, amount) as
      the primary element.
- [ ] A failing simulation blocks the default "Sign" button; opt-out is a
      distinct secondary action.
- [ ] Unit tests cover: simple ETH send, ERC-20 transfer, NFT transfer,
      `multicall`, reverting tx, unsupported chain.
- [ ] pnpm check:syntax passes.

## Out of scope

- Red-pill-resistant simulation context randomisation (§8 Phase 3,
  TWV-2026-014).
- Independent Safe tx-hash re-derivation (task 25, TWV-2026-033).
- Third-party risk-engine integration (Blockaid / GoPlus).
