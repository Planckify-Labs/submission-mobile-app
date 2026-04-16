# Task 50 — Partition hot-wallet keys per chain

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-037, §7, §9

## Why this matters

Phemex lost ~$85M in Jan 2025 across seven chains in minutes — a signature
pattern of a single BIP-32 seed whose compromise blast-radiuses every
derived address on every chain. TakumiAI does not today operate
production hot wallets, but the architecture decision of "one seed covers
many chains" is the default, and it needs an explicit written policy
before any custody-adjacent surface (fiat on/off-ramp float, paymaster
funding, agent-owned wallets) ships.

## Scope

This is a design-property task, not a code task. Deliverables:

- Write a new section in `docs/wallet-security-vulnerabilities-spec.md`
  appendix (or a sibling `docs/hot-wallet-custody-policy.md`, whichever
  the team prefers) covering:
  - Definition of "hot wallet" in the TakumiAI context (any key the
    backend, paymaster, or agent holds online and can move funds with,
    excluding end-user device-held keys).
  - Rule: no production hot wallet derives keys for more than one
    `eip155` chain from the same seed. Each chain gets its own key
    material sourced from OS CSPRNG at generation, stored under a
    chain-scoped SecureStore / KMS handle.
  - Rule: purpose-partition too — onboarding-sponsorship float is a
    different key from agent-execution float is a different key from
    hot-treasury refill. One seed per (chain, purpose).
  - Anomaly-detection hooks: withdrawal volume / velocity thresholds per
    (chain, purpose) key; auto-pause at N-σ deviation.
- Add a pre-implementation checklist to the custody-adjacent tasks in the
  roadmap: no PR that introduces a server-held signing key may merge
  without this checklist passing review.
- Flag TWV-2026-037 as a review gate in `docs/wallet-security-task/` —
  any future task that touches `services/agent-executors/` key handling
  or introduces backend-held keys must reference this task.

## Rules (non-negotiable)

- No single seed derives keys for multiple production chains. Period.
- Single-seed derivation is allowed only for end-user wallets, where the
  user has explicitly accepted the multi-chain blast radius (BIP-39
  education screen from Phase 1 covers this).
- Policy document is the source of truth; any code that provisions a
  backend key must cite it in its PR description.

## Acceptance

- [ ] Policy document exists and is linked from the spec.
- [ ] Pre-implementation checklist added; at least one custody-adjacent
      task in the backlog references it.
- [ ] Review-gate entry added so new backend-key work cannot silently
      bypass this.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Implementing a KMS integration (no backend hot wallets today).
- Anomaly-detection service code (design-only here).
- End-user-wallet seed derivation — that is education, not partition.
