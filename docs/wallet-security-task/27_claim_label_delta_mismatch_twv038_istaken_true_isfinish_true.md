# Task 27 — Claim-label vs simulated-delta mismatch warning

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-038, §7, §9

## Why this matters

Penpie lost $27M in part because users treat "Claim rewards" as a
one-click, low-risk flow and sign without reading. Malicious "claim"
flows exploit this: the UI label says `Claim`, the calldata drains.
The wallet must compare the dApp-supplied label against the simulated
net asset delta and flag the mismatch — a "claim" that produces zero
or negative inflow is a red flag, regardless of what the dApp's UI
said.

## Scope

- Extend the signer UI pipeline (depends on task 17's transaction
  simulator) to compute the net signed-in-user asset delta in native
  token equivalent.
- Add a label heuristic that matches any of `claim|harvest|collect|
  redeem` in:
  - the dApp-supplied tx title / description,
  - the top-level decoded function selector's name
    (e.g., `claim*`, `harvest*`, `redeemRewards`).
- When the heuristic matches AND the simulated net delta is `<= 0`
  (in native-token equivalent), render a red "Claim flow with no net
  inflow — proceed only if you are sure" banner and require a
  secondary tap to enable the Sign button.
- Log the mismatch event (no PII) so we can tune heuristics later.
- Copy lives in the signer-UI strings file; no secrets.

## Rules (non-negotiable)

- The heuristic must never auto-reject; it warns and raises friction.
  Users can still sign if they insist.
- If simulation failed or was skipped, fall back to the existing
  blind-sign warning — do not silently suppress the heuristic.
- Label source is canonical: prefer decoded function name over
  dApp-supplied text. Never trust dApp text alone.

## Acceptance

- [ ] With simulator ON, a synthetic `claim` tx that yields zero
      inflow triggers the mismatch banner in the signer UI.
- [ ] A legitimate `claim` tx with a positive native-equivalent
      inflow does NOT trigger the banner.
- [ ] Unit tests cover the label matcher against the known label set
      and a handful of adversarial strings.
- [ ] Telemetry event fires on trigger (no tx data, no addresses).
- [ ] Regression: non-claim flows unchanged.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Contract-age / audit-status lookups (GoPlus / DefiLlama — Phase 3).
- Whole-wallet value-at-risk calculations.
- Building the simulator itself — see task 17.
