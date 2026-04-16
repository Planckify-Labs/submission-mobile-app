# Task 57 — Enforce ERC-7562 validation rules on paymaster / bundler

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-045, §7, §9

## Why this matters

Gas-griefing attacks on ERC-4337 craft UserOps that maximise
`verificationGasLimit` or `postOpGasLimit` usage without achieving
stated work, forcing the bundler or paymaster to absorb gas beyond
pre-computed estimates. ERC-7562 formalises validation-phase storage
and opcode rules that close most of this griefing surface when
bundlers enforce them. TakumiAI's integration acceptance criteria have
to demand ERC-7562 enforcement before a paymaster or bundler vendor is
adopted.

## Scope

Integration-acceptance-criteria task. Deliverables:

- Extend `docs/bundler-integration-spec.md` (task 54) and
  `docs/paymaster-policy-spec.md` (task 53) with an ERC-7562
  enforcement section:
  - Bundler vendor MUST enforce ERC-7562 validation rules in
    pre-bundle simulation: no forbidden opcodes (`GAS`, `GASPRICE`,
    `TIMESTAMP`, etc. per spec) in restricted phases, no banned
    storage-slot access during validation.
  - Paymaster's `validatePaymasterUserOp` enforces tight gas bounds:
    reject UserOps where
    `verificationGasLimit + preVerificationGas + callGasLimit`
    exceeds a category-specific ceiling.
  - Per-sender gas-used vs gas-estimate delta monitoring; senders
    with chronic high deltas are throttled and eventually denylisted.
  - Any custom paymaster or account module the wallet ships must pass
    a dedicated ERC-7562 test-vector suite before first production
    use.
- Add a pre-implementation checklist to the smart-account roadmap:
  bundler / paymaster vendor selection cannot be finalised without
  written confirmation of ERC-7562 enforcement.
- Flag TWV-2026-045 as a review gate.

## Rules (non-negotiable)

- ERC-7562 enforcement is a hard requirement for any bundler /
  paymaster the wallet uses in production; non-conforming vendors are
  rejected regardless of commercial terms.
- Gas bounds are enforced in-contract (paymaster-side), not only
  in the client submission layer.
- Per-sender metrics are persisted and consulted; a clean-slate
  restart does not erase a sender's prior abuse history.

## Acceptance

- [ ] `docs/bundler-integration-spec.md` and
      `docs/paymaster-policy-spec.md` each include an ERC-7562
      section.
- [ ] Pre-implementation checklist added and linked from the
      smart-account roadmap entry.
- [ ] Review gate recorded; test-vector suite description exists (no
      implementation required in this task).
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Writing the ERC-7562 test-vector suite.
- Building a custom paymaster contract.
- Implementing per-sender monitoring backend.
