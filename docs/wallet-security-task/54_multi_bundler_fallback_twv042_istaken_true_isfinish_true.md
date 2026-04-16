# Task 54 — Multi-bundler fallback for UserOp submission

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-042, §7, §9

## Why this matters

ERC-4337 bundlers sit between the user's UserOp and the mempool. A
malicious or misbehaving bundler can censor, front-run, reorder, or
delay UserOps for MEV. Unlike public-mempool RPCs, bundlers have a
unique trust surface because there is no cryptographic commitment that
a bundler must include every valid UserOp it receives. TakumiAI does
not ship smart accounts today, but when it does, the client must treat
bundlers as first-class, plural, and fall-through-able — the
architecture has to exist before the feature.

## Scope

Design-property task. Deliverables:

- Write `docs/bundler-integration-spec.md` describing a client-side
  bundler fallback strategy:
  - Configure ≥ 2 independent bundler vendors (e.g., Pimlico, Alchemy,
    Stackup, Candide). "Independent" per the rules in task 51 — no
    shared infra or admin.
  - Submission protocol: submit to bundler A; if UserOp is not included
    within N blocks, retry via bundler B; alert the user if all
    bundlers time out.
  - Prefer bundlers with published inclusion SLAs and
    private-mempool / Flashbots-equivalent builder integration for
    MEV-sensitive UserOps.
  - For swap-heavy UserOps, route through anti-MEV paths (commit-reveal
    or a protocol-native batcher such as CoW) regardless of bundler.
  - Observability: per-bundler inclusion-latency metric; alert when
    one bundler systematically lags.
- Generalise `services/rpc/` (or the Phase-2 replacement) to treat
  bundler URLs as first-class alongside RPC URLs; a bundler entry is
  not just a "URL string" but a typed record with `entryPoint`,
  `chainId`, `vendor`, `slaPolicy`.
- Add a pre-implementation checklist to the smart-account roadmap
  entry: no smart-account feature ships with only one bundler.

## Rules (non-negotiable)

- Minimum two bundlers per supported chain; single-bundler deploys are
  not allowed in production.
- Bundler list is deploy-time or signed remote config; never
  dApp-controlled.
- Client retries respect the paymaster's nonce / gas guarantees —
  resubmitting to bundler B must not invalidate a paymaster signature
  issued for a specific EntryPoint.
- MEV-sensitive UserOps (swaps, liquidations) default to the private
  path unless the user explicitly opts into public.

## Acceptance

- [ ] `docs/bundler-integration-spec.md` exists with the fallback
      protocol and observability plan.
- [ ] `services/rpc/` generalisation plan captured (design note only,
      no code change required in this task).
- [ ] Pre-implementation checklist linked from the smart-account
      roadmap entry.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Building the bundler client (future smart-account task).
- Vendor procurement and commercial terms.
- Building a private-mempool / Flashbots integration (tracked
  separately under TWV-2026-050 / task 28).
