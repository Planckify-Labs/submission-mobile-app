# Task 61 — Uniswap v4 hook address + allowlist display

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-053, §7, §9

## Why this matters

Uniswap v4 pools carry optional hook contracts invoked at pool
lifecycle events. Hooks can request approvals or call arbitrary logic,
and wallet UIs that render "Approve Uniswap v4 PoolManager" risk
eliding the hook identity — users think "Uniswap is trusted," but the
pool they are interacting with may route every swap through a
third-party hook. The mitigation is surface the hook address and
reputation. TakumiAI does not today parse v4 calldata; the design note
ensures the decoder adds this when v4 support lands.

## Scope

Design-property task. Deliverables:

- Write a design note in `services/decoders/calldata.ts` (as a
  top-of-file comment block and in `docs/calldata-decoder-spec.md` if
  that doc exists) covering:
  - When decoding calls to the v4 `PoolManager`, extract the `PoolKey`
    from calldata and display the hook address prominently.
  - Resolve the hook's name and audit status from a curated registry
    (`constants/uniswap-v4-hooks.ts` — seeded with Uniswap Labs /
    known-partner hooks). Unknown hooks render as "Custom hook — pool
    logic provided by a third party."
  - Distinguish "Uniswap v4 pool with a hook" from "Uniswap v4 pool
    without a hook" in signer-UI copy.
  - Simulate the swap including `beforeSwap` / `afterSwap` hooks and
    display the asset delta; unexpected transfers to unknown
    addresses trigger a red warning (cross-link to task 27's
    label-vs-delta mismatch rule).
- Add a pre-implementation checklist to any roadmap entry that adds v4
  support: decoder update, hook allowlist, simulation integration.
- Flag TWV-2026-053 as a review gate on the decoder module.

## Rules (non-negotiable)

- Hook address is always displayed in the signer UI when a v4 swap is
  being signed; never abbreviated away.
- Unknown hooks are labelled explicitly; the wallet does not imply
  Uniswap-ecosystem trust for a hook it does not recognise.
- Allowlist is shipped in-bundle with a dated source comment; updates
  are code PRs, not runtime fetches.
- Simulation is required for v4 signs; if the simulator is unavailable
  for the target chain, the UI warns "cannot simulate — proceed only
  if you trust this pool."

## Acceptance

- [ ] Design note exists in `services/decoders/calldata.ts` or a
      linked spec doc.
- [ ] `constants/uniswap-v4-hooks.ts` seed data plan is captured (no
      runtime file required in this task, but the shape is defined).
- [ ] Pre-implementation checklist linked from the v4-support roadmap
      entry.
- [ ] Review gate recorded; cross-link to task 27.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Implementing the v4 calldata decoder.
- Building the hook registry as a live feed.
- Simulating v4 execution (depends on task 17).
