# Task 53 — Paymaster allowlist + per-sender caps

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-041, §7, §9

## Why this matters

ERC-4337 paymasters commit to pay gas in `validatePaymasterUserOp`
*before* execution succeeds. Naive paymasters can be drained by
attackers crafting UserOps that pass validation and then burn gas in
`postOp` or revert at execution. TakumiAI does not ship sponsored gas
today, but it is a common onboarding-UX feature and the agent's executor
layer is a natural place for it to land. The policy module has to exist
before the feature does, not after.

## Scope

Design-property task. Deliverables:

- Write `docs/paymaster-policy-spec.md` covering:
  - Per-sender rate limits (UserOps per minute / hour / day).
  - Per-sender cumulative gas caps (wei-denominated; enforced in
    `validatePaymasterUserOp`).
  - Target allowlist: paymaster only sponsors UserOps whose `callData`
    decodes to an allowlisted `(contract, function-selector)` pair
    (e.g., our own account contract's `execute`, known DEX routers).
  - Denylist sync: near-real-time ingestion of the bundler's
    "reverting-at-execution" sender list.
  - Signature-based sponsorship: prefer an off-chain signer that
    co-signs approved UserOps, so authorisation lives in our infra
    rather than a permissive on-chain check.
  - ERC-7562 validation-rule enforcement (no forbidden opcodes, no
    banned storage-slot access) — cross-link to task 57.
- Add a pre-implementation checklist: any PR that introduces a
  paymaster contract or paymaster-signing backend cannot merge without
  the policy module and its unit tests.
- Flag TWV-2026-041 as a review gate on `services/agent-executors/` —
  if the agent grows a "pay gas for the user" tool, it must route
  through the policy module.

## Rules (non-negotiable)

- No paymaster ships without rate limits, gas caps, AND target
  allowlist — all three; any two is insufficient.
- Denylist is honoured; a sender's revert-rate metric is persisted and
  consulted on every sponsorship decision.
- Policy configuration is deploy-time constants or signed remote
  config; never user-input-controlled.

## Acceptance

- [ ] `docs/paymaster-policy-spec.md` exists with all four rule
      categories and wired-in ERC-7562 reference.
- [ ] Pre-implementation checklist appended; roadmap entries that
      introduce sponsored gas cross-link here.
- [ ] Review gate recorded against `services/agent-executors/`.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Building the paymaster contract itself.
- Choosing a bundler vendor (tracked in task 54).
- Gas-price oracle design.
