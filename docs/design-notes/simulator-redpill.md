# Red-pill-resistant simulator review

**Spec reference:** `wallet-security-vulnerabilities-spec.md`
TWV-2026-014 (task 46). Companion: TWV-2026-011 (task 17, pre-sign
simulation), TWV-2026-038 (task 27, claim-label vs delta mismatch),
TWV-2026-008 (task 8, Permit/Permit2 decoding).

**Status:** Design review. Locks in the required simulator properties
before task 17's full pre-sign simulation feature ships.

Malicious contracts fingerprint simulation environments — reading
`block.prevrandao`, `block.timestamp`, `tx.origin`, `gasprice`, and
friends — and return benign state when they detect simulation while
draining funds when mined. ZenGo disclosed this class against
Coinbase Wallet and several dApps in 2022. If the pre-sign simulator
naively uses default node-RPC semantics, it provides false comfort.
This review captures the audit of the current simulation surface,
the required properties for future work, and the vendor-disclosure
questionnaire.

## 1. Current-state inventory — 2026-04-16

Source file: `services/agent-executors/simulate.ts`.

Exposed executor tools:

- `estimate_gas` — calls `publicClient.estimateGas` on the configured
  RPC for the chain. No state-delta simulation; no asset-flow
  preview.
- `request_authentication` — SIWE login flow; unrelated to tx
  simulation.

**Finding:** Takumi has no pre-sign asset-delta simulator today. The
`estimate_gas` executor returns a gas value and nothing else. The
feature that `simulate.ts` will host when task 17 / TWV-2026-011
lands is not yet implemented.

Implication: the required properties in §2 apply at design time for
the next iteration of this module. The §3 vendor-disclosure question
set is ready for the first simulation-vendor evaluation the team
runs.

## 2. Required simulator properties

Any future pre-sign simulator — local, outsourced, hybrid — MUST:

### 2.1 Context randomisation

Simulation must present a context that matches realistic mined
distributions so contracts cannot fingerprint it:

- `block.prevrandao`: random per simulation, sampled from a
  deterministic-but-unpredictable-to-the-contract source.
- `block.timestamp`: within a realistic jitter window of the current
  wall-clock time (e.g., +/- 30 s around "now"; never a fixed
  `1000000000`-style value).
- `tx.origin`: the actual signing address for the tx, not
  `0x0000…` or `0xcafe…`.
- `msg.value`: the actual tx value.
- `block.number`: the current head block number for the chain, not
  a fixed constant.
- `gasprice`: within normal distribution.

A contract that reads these and switches on anomalous values MUST
see realistic ones.

### 2.2 Multi-provider diff

- Simulate against **≥ 2 independent simulation providers**
  (e.g., one local node RPC with state-override, one third-party
  service such as Tenderly / Blockaid) and compare deltas.
- Mismatch is a red-flag signal — a contract returning different
  state under different providers suggests environment-specific
  behaviour. The signer UI surfaces the mismatch and recommends
  caution.
- "Independent" per the independence spec (task 51 /
  TWV-2026-039) — providers should not share cloud infra or admin
  teams.

### 2.3 Reputation overlay

- Contracts whose simulated behaviour diverges from their **recent
  mined behaviour** get a Blockaid / GoPlus-style warning even when
  the simulation output looks benign. The history is consulted via
  the on-chain history indexer (`services/indexer/`).
- Fresh contracts (on-chain < 30 days) get a "new contract" badge.

### 2.4 Not the sole safety signal

Simulation output NEVER suppresses calldata-decoding warnings (task
8 / TWV-2026-008). It augments them. The signer UI's decision
logic is:

```
safe_to_sign = calldata_decode_safe
             AND (simulation_safe OR simulation_unavailable_with_warn)
             AND reputation_ok
             AND allowlist_checks_ok
```

A green simulation never flips a red decoded-calldata warning to
green.

## 3. Vendor-disclosure question set

When a simulation vendor is evaluated, the security team sends this
one-pager and files the responses in the private ops folder:

1. **Context randomisation policy:** which EVM environment fields
   does the simulator randomise, and what distributions do you
   sample from? Link to docs or code if available.
2. **Multi-provider posture:** do you expose a "diff against a
   second provider" mode? If not, is it on your roadmap?
3. **Known bypass CVEs:** list any published contracts or patterns
   that are known to detect and bypass your simulator. Include
   mitigation status per pattern.
4. **Attestation-of-simulation output:** can the simulator
   cryptographically attest that its output came from a specific
   code-version of the simulator? (This is the analogue of task 48
   / TWV-2026-034 for simulation: make the simulation result itself
   reproducible by an auditor.)
5. **State-override support:** does the simulator accept a state
   override (e.g., `eth_call` with `stateOverrideSet`) so we can
   override `block.number`, `block.timestamp`, caller balance?
6. **Per-chain coverage + SLA:** which chains are covered and what
   is the P95 simulation latency? What is the SLA for "simulator
   unavailable"?
7. **Log retention / privacy:** what tx data do you log, for how
   long, and how is it protected?

If the vendor cannot document §1, §2, or §4, the vendor's output is
treated as **advisory** in our signer UI — decoded calldata and
allowlist checks carry the decision instead.

## 4. Review gate

- Any PR that introduces a simulation executor, a signer-UI warning
  tied to simulation output, or a simulator-vendor swap MUST cite
  TWV-2026-014 and re-read §2's properties.
- `services/agent-executors/simulate.ts` is the review-gate anchor;
  reviewers block changes that add a simulation path without the §2
  properties.
- PR template prompt: "touches simulator or adds a safety warning
  tied to simulation? cite TWV-2026-014."

## 5. "Simulation is not the sole safety signal" — signer-UI copy

When writing the signer UI spec (task 17 / TWV-2026-011 + future
work), include the following above the fold of the signing sheet:

> Simulation is a best-effort preview of what this transaction
> would do. Contracts can detect simulation environments and behave
> differently when mined. The signer's decision to warn or block
> also depends on what the calldata says and which addresses are
> allowlisted.

## 6. Cross-links

- Task 17 / TWV-2026-011 — pre-sign transaction simulation + asset-
  delta display. This note is a review gate on that work.
- Task 8 / TWV-2026-008 — Permit/Permit2 decoding; pairs with
  simulation.
- Task 27 / TWV-2026-038 — claim-label vs simulated-delta mismatch.
- Task 51 / TWV-2026-039 — independence property applied to the
  multi-provider diff.
