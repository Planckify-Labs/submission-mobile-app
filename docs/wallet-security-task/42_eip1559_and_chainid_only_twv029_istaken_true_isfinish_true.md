# Task 42 — EIP-1559-only + chainId on every signed payload

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-029, §7, §9

## Why this matters

A tx signed without chain-id binding can be replayed on a forked
chain that shares history (ETH/ETC 2016, ETH/ETHW 2022). EIP-155
fixed legacy transactions; EIP-1559 (type-2) and EIP-2930 (type-1)
mandate chain-id; EIP-712 requires `domain.chainId`. This task locks
in the rule that every signed payload carries chain-id, and adds
regression tests so a refactor can't silently re-introduce a
type-0 legacy signing path.

## Scope

Audit + tests task:

- Grep the repo for `signTransaction`, `sendTransaction`, any
  Viem client `writeContract`/`walletClient.sign*` call site, and
  EIP-712 signers. Enumerate the call sites in
  `docs/design-notes/chainid-binding.md`.
- Confirm each call site either (a) is type-1/type-2 with explicit
  `chainId`, or (b) is a documented exception (the note lists zero
  today; exceptions are filed as tickets, not waivers).
- Add regression unit tests:
  - Transaction signer refuses a payload missing `chainId`.
  - EIP-712 signer refuses typed data missing `domain.chainId` or
    where `domain.chainId` != active chain (the latter pairs with
    Task 45, TWV-2026-012).
  - Transaction signer refuses `type: 'legacy'` unless an explicit
    user-opt-in path that is currently unbuilt (the test ensures
    the default path is always EIP-1559).
- Document the fork-event runbook: at any upcoming fork event,
  rotate nonces on affected chains or use the same-nonce
  invalidation technique from EIP-3788.
- Flag TWV-2026-029 as a review gate on any PR touching signer call
  paths or tx-building helpers.

## Rules (non-negotiable)

- Every signed transaction binds `chainId`. No legacy-type default.
- Every EIP-712 payload binds `domain.chainId`; the signer refuses
  if it is missing or mismatched against the active chain.
- No "skip chainId for gas estimation" shortcuts — estimation is not
  a signed path, but no helper may share a code path that drops
  chain-id.

## Acceptance

- [ ] `docs/design-notes/chainid-binding.md` landed with the
      call-site enumeration.
- [ ] Regression unit tests land covering: missing chainId, legacy
      tx default, EIP-712 missing / mismatched `domain.chainId`.
- [ ] Any call site without explicit chainId binding is filed as a
      follow-up (expected: none; record the negative result).
- [ ] Fork-event runbook entry added under `docs/runbooks/`.
- [ ] PR template gains a "touches signer / tx-builder? cite
      TWV-2026-029" prompt.
- [ ] pnpm check:syntax passes.

## Out of scope

- Removing legacy-tx support from Viem (we use defaults).
- Multi-chain atomic swap flows.
- Hardware-wallet signing paths (covered by Phase 3 HW tasks).
