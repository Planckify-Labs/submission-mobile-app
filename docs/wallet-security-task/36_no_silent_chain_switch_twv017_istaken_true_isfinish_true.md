# Task 36 — No silent chain switches

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-017, §7, §9

## Why this matters

EIP-3326 lets a dApp call `wallet_switchEthereumChain` and
immediately follow with a signature request. If the bridge ever
"remembers" a prior switch approval for an origin, the user sees a
signature prompt for a chain they don't realise they're on — a
well-known drainer pattern. This task locks in the UX rule that every
switch is an explicit user tap, and verifies the permission store
never degrades into silent auto-approval.

## Scope

This is a policy + light-audit task — the enforcement already lives
in `services/permissions/store.ts` (see Task 12 background). Deliver:

- A design note in `docs/design-notes/chain-switch-ux.md` that states:
  - Every `wallet_switchEthereumChain` renders an approval sheet;
    grants for prior chains never short-circuit a fresh prompt.
  - The signer UI (existing `SignSheet`) shows the active chain
    ("Signing on: Base") in the header on every prompt, sourced from
    the registry chainId (not RPC; pairs with Task 07,
    TWV-2026-016).
  - Back-to-back switch+sign within 2 seconds must reshow a chain
    banner on the signature sheet even if both were approved.
- Audit notes: grep `services/permissions/` and any bridge code path
  for "remember this choice" / "auto-approve" flags on chain switches
  and record the result in the design note.
- Add a manual regression test row to §7.2's manual matrix covering
  the switch+sign timing rule.
- Flag TWV-2026-017 as a review gate on any future change that adds
  caching or remembered state to chain-switch approvals.

## Rules (non-negotiable)

- Chain switches are never persisted as "always approve" — approval
  is per-call, always.
- Signer header always shows the chain being signed on; the value is
  sourced from the registry, not from RPC `eth_chainId`.
- Any PR that touches chain-switch approval flow cites TWV-2026-017
  in the description.

## Acceptance

- [ ] `docs/design-notes/chain-switch-ux.md` landed describing the
      rule and the three invariants above.
- [ ] Audit findings for "remember" / "auto-approve" flags recorded
      in the design note (expected: none; record the negative result
      as proof).
- [ ] §7.2 manual regression matrix updated with the switch+sign
      timing case.
- [ ] PR template gains a "touches chain-switch flow? cite
      TWV-2026-017" prompt.
- [ ] pnpm check:syntax passes.

## Out of scope

- Implementing a new approval cache for chain switches (this task
  forbids it).
- Switching signature UI to a different component (tracked under
  Task 14, TWV-2026-064).
- Multi-chain atomic swap UX.
