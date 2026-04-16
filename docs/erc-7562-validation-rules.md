# ERC-7562 validation-rule enforcement

**Spec reference:** `wallet-security-vulnerabilities-spec.md`
TWV-2026-045 (task 57). Companion: TWV-2026-041 (task 53, paymaster
policy), TWV-2026-042 (task 54, bundler integration).

**Status:** Integration-acceptance spec. No bundler or paymaster ships
today. This document is the acceptance contract — any PR that adds a
bundler integration, a paymaster contract, or an account module MUST
confirm the vendor / contract is ERC-7562-compliant before it can
merge.

## Pre-implementation checklist (merges block on any unchecked box)

- [ ] Bundler vendor has confirmed (in writing) ERC-7562 enforcement
      in pre-bundle simulation (§1).
- [ ] Paymaster contract passes the §2 gas-bound test vectors.
- [ ] Per-sender gas-used vs gas-estimate delta monitoring is wired
      up (§3).
- [ ] Custom paymaster / account modules have a dedicated ERC-7562
      test-vector suite — the §4 reference list is a minimum (§4).
- [ ] Smart-account roadmap cross-links this file.

This spec is cross-linked from `docs/paymaster-policy-spec.md` §6 and
`docs/bundler-integration-spec.md` §8. Those files reference this one
rather than duplicating the content.

## 1. Bundler-side enforcement

Any bundler we ship with MUST enforce ERC-7562 validation rules in
pre-bundle simulation. Vendor-written confirmation required at
integration time.

Rules the bundler rejects during validation phase:

- Forbidden opcodes: `GAS`, `GASPRICE`, `TIMESTAMP`, `BLOCKHASH`,
  `BASEFEE`, `DIFFICULTY`, `PREVRANDAO`, `COINBASE`, `NUMBER`, `BALANCE`,
  `ORIGIN`, `SELFBALANCE` — per the ERC-7562 restricted-phase list. Any
  call path reaching these during validation is rejected.
- Banned storage-slot access: `SLOAD` / `SSTORE` outside the
  sender-isolated slots and the paymaster's own state; cross-account
  storage reads during validation are rejected.
- `CALL` / `DELEGATECALL` / `STATICCALL` targets restricted to
  pre-approved roles (account, factory, paymaster, aggregator).

Non-conforming vendors are rejected regardless of commercial terms.
We do not ship a bundler we cannot verify.

## 2. Paymaster tight-gas bounds

`validatePaymasterUserOp` MUST enforce a category-specific ceiling:

```
verificationGasLimit + preVerificationGas + callGasLimit
  ≤ ceiling[category]
```

Categories + initial ceilings (tune per deployment):

| Category                | Ceiling (gas) |
|-------------------------|---------------|
| Simple transfer         | 500_000       |
| Single-call interaction | 2_000_000     |
| Swap                    | 5_000_000     |
| Batched / multicall     | 10_000_000    |
| Governance opt-in       | (no ceiling — governance tx only, manual review) |

Ceilings are contract-side constants, not client-side. Client re-checks
before submission to fail fast.

## 3. Per-sender delta monitoring

For each successful UserOp, record:

```
delta = gasUsed - gasEstimate
```

Metrics:

- Rolling 7-day P95 per-sender delta. Chronic high delta (P95 > 20%)
  signals a sender probing gas griefing.
- Throttle senders with chronic high deltas: reduce their rate limit
  (§1 of paymaster spec) by a factor of 4.
- Denylist senders with chronic high deltas AND repeated reverts at
  execution. Denylist propagates via the mechanism in
  `docs/paymaster-policy-spec.md` §4.

Metrics backend is the same as §4 of the bundler integration spec.

## 4. Test-vector suite (minimum)

Custom paymaster / account modules MUST pass a test-vector suite
covering:

- **TV-1:** UserOp with `verificationGasLimit` just below ceiling →
  accepted.
- **TV-2:** UserOp with `verificationGasLimit` just above ceiling →
  rejected.
- **TV-3:** Validation phase attempts `GAS` opcode → rejected.
- **TV-4:** Validation phase attempts `TIMESTAMP` opcode → rejected.
- **TV-5:** Validation phase reads cross-account storage slot →
  rejected.
- **TV-6:** Validation phase performs `CALL` to a non-approved target
  → rejected.
- **TV-7:** Post-op phase consumes > paymaster's stated `postOpGasLimit`
  → paymaster covers the shortfall, but the sender is denylist-flagged.
- **TV-8:** Rate-limit exceeded (§1 of paymaster spec) → rejected
  before the work happens.
- **TV-9:** Signature expired (§5 of paymaster spec) → rejected.
- **TV-10:** Target not on allowlist (§3 of paymaster spec) → rejected.

The test-vector suite is run against the paymaster contract before
every production deploy and is blocking on CI.

## 5. Persistence property

Per-sender metrics (delta history, throttle state, denylist status)
persist across restarts. A clean-slate restart does not erase a
sender's prior abuse history. See `docs/paymaster-policy-spec.md` §1.

## 6. Review gate

- `docs/bundler-integration-spec.md` § "ERC-7562 enforcement"
  references this file.
- `docs/paymaster-policy-spec.md` §6 references this file.
- Any PR that adds a new bundler vendor, paymaster contract, or
  account module MUST cite TWV-2026-045 and attach the test-vector
  suite run output.

## 7. Cross-links

- Task 53 / TWV-2026-041 — paymaster policy (this spec is referenced
  from §6 there).
- Task 54 / TWV-2026-042 — bundler integration (this spec is
  referenced from §8 there).
- Task 56 / TWV-2026-044 — UserOp hash binding (account-contract
  review gate).
