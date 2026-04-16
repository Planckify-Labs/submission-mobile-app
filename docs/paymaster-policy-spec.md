# Paymaster policy spec

**Spec reference:** `wallet-security-vulnerabilities-spec.md`
TWV-2026-041 (task 53). Companion: TWV-2026-042 (task 54, multi-bundler),
TWV-2026-045 (task 57, ERC-7562 validation rules), TWV-2026-044
(task 56, UserOp hash binding).

**Status:** Design-property spec. No paymaster ships today. This
document is the pre-implementation contract — any PR that introduces a
paymaster contract or a paymaster-signing backend must satisfy every
rule below before it can merge. The agent executor layer
(`services/agent-executors/`) is the most likely first consumer; this
spec is a review gate on that module.

## Pre-implementation checklist (merges block on any unchecked box)

- [ ] Per-sender rate limits (§1).
- [ ] Per-sender cumulative gas caps (§2), enforced on-contract.
- [ ] Target allowlist (§3) — only specific `(contract, selector)`
      pairs are sponsor-eligible.
- [ ] Denylist sync (§4) — revert-at-execution senders are ingested
      near-real-time.
- [ ] Signature-based sponsorship (§5) — off-chain signer co-signs
      approved UserOps.
- [ ] ERC-7562 validation-rule enforcement (§6, cross-link task 57).
- [ ] Policy configuration is deploy-time constants or signed remote
      config; never user-input-controlled (§7).
- [ ] Unit tests cover each of §1–§5 individually plus the full
      combined policy path.

All five of {rate limits, gas caps, target allowlist, denylist sync,
signature-based sponsorship} ship together. Any subset is insufficient.

## 1. Per-sender rate limits

```
limits = {
  userOpsPerMinute: 5,
  userOpsPerHour:   30,
  userOpsPerDay:   100,
}
```

(Numbers are the initial defaults; they are tuned per deployment.)

Enforcement layers:

- **On-chain:** the paymaster contract tracks `lastUserOpBlock` +
  `userOpCount24h` per sender and reverts `validatePaymasterUserOp`
  when limits are exceeded. Contract-side is authoritative.
- **Off-chain:** the sponsorship backend also rate-limits so the
  client gets a fast rejection before paying the on-chain revert
  cost. Backend limits are always tighter-or-equal to the contract
  limits.

Persistence:

- Counters are persisted per sender and survive app restarts, server
  restarts, and cache flushes. A clean-slate restart does NOT erase a
  sender's prior history.

## 2. Per-sender cumulative gas caps

```
gasCaps = {
  perUserOp:      2e7 gas-units,   // reject UserOps above this
  perDayGasWei:  (tune per chain),
  perDayUserOps: limits.userOpsPerDay,
}
```

Enforcement:

- Wei-denominated caps are enforced in-contract in
  `validatePaymasterUserOp` before the paymaster commits to pay.
- `verificationGasLimit + preVerificationGas + callGasLimit` is
  compared against `gasCaps.perUserOp` in the contract; over-limit
  UserOps revert.

## 3. Target allowlist

The paymaster ONLY sponsors UserOps whose `callData` decodes to an
allowlisted `(targetContract, functionSelector)` pair.

Initial allowlist (examples; finalised per deployment):

- Our own account contract's `execute` / `executeBatch` selectors.
- Known DEX routers (Uniswap Universal Router, 1inch AggregationRouter,
  0x Proxy).
- Known bridge contracts with short-list-only entries.

Anything else rejects. No "wildcard" entries.

Implementation:

- Allowlist is a contract storage `mapping(address => mapping(bytes4 =>
  bool))` updated only by a governance tx (multisig). Governance key
  independence per task 51 / TWV-2026-039.
- Client-side: `services/decoders/calldata.ts` resolves the selector
  before submission; the sponsorship backend re-checks server-side;
  the contract re-checks on-chain (three layers, fail-closed).

## 4. Denylist sync

Bundlers maintain lists of senders whose UserOps chronically revert at
execution (after passing validation). Those senders are draining
paymasters.

Sync pipeline:

- Subscribe to the bundler's denylist feed (polling or webhook). Vendor-
  specific — documented in `docs/bundler-integration-spec.md`.
- Ingest into our paymaster backend's revert-rate tracker with
  near-real-time latency (< 1 minute P95).
- On-contract: denylist is propagated via a signed update tx. Denylisted
  senders revert at `validatePaymasterUserOp`.

Persistence: denylist is authoritative at the contract layer; off-chain
caches exist only for performance.

## 5. Signature-based sponsorship

Authorisation lives in **our** infra, not in a permissive on-chain
check.

Design:

- Off-chain signer (HSM-backed; key in KMS) signs an approval that
  says: "Sender X may submit this UserOp with gas ≤ Y valid until
  time Z."
- Paymaster contract verifies the signature in
  `validatePaymasterUserOp`. Expired / mismatched approvals revert.
- Client flow: UserOp → sponsorship backend → co-signed approval →
  bundler. See `docs/bundler-integration-spec.md` §6 for retry
  compatibility (approval validity window is generous enough to cover
  a bundler retry).

Operational:

- Signer key rotation is a governance tx; the old key is valid for a
  grace window, then revoked.
- Two-person approval (KMS IAM policy) on every signer-key action, per
  TWV-2026-055 / task 9 posture.

## 6. ERC-7562 enforcement (cross-link task 57)

The paymaster itself must be ERC-7562-compliant:

- `validatePaymasterUserOp` uses no forbidden opcodes in the
  validation phase (`GAS`, `GASPRICE`, `TIMESTAMP`, `BLOCKHASH`, etc.
  per the spec).
- No access to banned storage slots during validation.
- Gas bounds honoured.

Custom paymaster contracts pass a dedicated ERC-7562 test-vector suite
before first production use. Test-vector definitions: cross-link to
`docs/wallet-security-task/57_erc7562_validation_rules_twv045_*`.

## 7. Provenance of policy configuration

Policy configuration (rate limits, gas caps, allowlist entries,
denylist sources) MUST come from one of:

- Deploy-time constants.
- Signed remote config verified against the EAS Update code-signing
  certificate (task 9 / TWV-2026-055).

User input, dApp JSON-RPC params, deeplink query strings, and push
notifications are never policy sources. No override.

## 8. Review gate

- `services/agent-executors/` — if the agent grows a "pay gas for the
  user" tool, that PR MUST reference TWV-2026-041, route through the
  policy module, and confirm §1–§7.
- Paymaster contract PRs — MUST include the ERC-7562 test-vector run
  output and the unit-test coverage for §1–§5.

## 9. Cross-links

- Task 51 / TWV-2026-039 — independence for the paymaster signer +
  governance keys.
- Task 54 / TWV-2026-042 — multi-bundler fallback; paymaster
  signatures must be retry-compatible.
- Task 56 / TWV-2026-044 — UserOp hash binding; paymaster verifies
  the same preimage shape.
- Task 57 / TWV-2026-045 — ERC-7562 validation rules.
- Task 9 / TWV-2026-055 — EAS Update code signing; reused as the
  trust anchor for signed remote config.
