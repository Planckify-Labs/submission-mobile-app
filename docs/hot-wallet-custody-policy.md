# Hot-wallet custody policy

**Spec reference:** `wallet-security-vulnerabilities-spec.md`
TWV-2026-037 (task 50). Companion: TWV-2026-039 (task 51,
independence), TWV-2026-041 (task 53, paymaster policy).

**Status:** Policy document. No production hot wallet ships today.
This policy MUST be satisfied before any custody-adjacent surface
(fiat on/off-ramp float, paymaster funding, agent-owned wallets,
backend-held signing keys) is introduced.

## 1. Definition of "hot wallet"

A hot wallet is any key held online, where "online" means:

- Reachable by a service process (backend, paymaster, agent executor)
  without a human-in-the-loop unlock.
- Loaded in memory of a long-running service.
- Held by a KMS / HSM that issues signatures on behalf of a service.

This includes paymaster funding keys, agent-owned wallets, onboarding-
sponsorship float, hot-treasury refill keys, and any signer that can
move funds without an end-user device unlock.

It **excludes** end-user device-held keys (seed phrases the user holds
on their phone). Those are governed by the client-side wallet-security
work across TWV-2026-002 through TWV-2026-065.

## 2. Per-chain partition (no shared seed across chains)

**Rule:** No single seed derives keys for more than one `eip155` chain
in production. Each chain's hot-wallet key material is sourced from an
OS CSPRNG at generation and stored under a chain-scoped SecureStore /
KMS handle.

Rationale: Phemex lost ~$85M in Jan 2025 across seven chains in
minutes. The signature pattern was that of a single BIP-32 seed whose
compromise blast-radiuses every derived address on every chain. The
operational convenience of "one seed, many chains" is not worth the
correlated-loss mode.

Enforcement:

- Key generation is performed by a dedicated provisioning script that
  produces a fresh key per `(chain, purpose)` (§3). The script does
  NOT offer a "derive from existing seed" option.
- The key-storage backend enforces uniqueness: a key's storage handle
  is scoped to a single `chainId`; attempting to reuse a handle for
  a second chain is a provisioning error.

## 3. Per-purpose partition

**Rule:** Within a chain, different purposes get different keys.

Purposes we enumerate today:

- **Onboarding sponsorship float** — pays gas on behalf of new users
  during onboarding.
- **Agent execution float** — funds the agent's own signing for the
  limited set of agent tools that move funds.
- **Hot-treasury refill** — replenishes the above floats from cold
  storage.
- **Paymaster funding** — backs the paymaster contract.

Each is `(chain, purpose) -> distinct key`. No sharing.

Rationale: compromise of the agent-execution float should not drain
the onboarding float; compromise of the paymaster funding key should
not expose the hot-treasury refill key. Blast-radius containment
scales with partition granularity.

## 4. Provisioning ceremony

When a new `(chain, purpose)` key is created:

- Performed on a dev-machine that passes task 49's posture check
  (TWV-2026-036). A compromised dev machine invalidates the ceremony.
- Two-person review: a second engineer witnesses the ceremony output
  (public key + handle; never the private key) before the handle is
  committed to the service config.
- The public key is recorded in the on-chain provenance ledger (if
  deployed) or in an append-only internal log with the engineer IDs
  + timestamp.
- The ceremony runbook lives in the private ops folder. Public
  summary: this file.

## 5. Anomaly-detection hooks

Every `(chain, purpose)` key is monitored:

- **Withdrawal volume** per rolling 5 min / 1 hr / 24 hr window.
- **Withdrawal velocity** (count of sends per window).
- **Counterparty novelty** (fraction of sends to addresses not seen
  before in the prior 30 days).

Thresholds are per-key and tuned at provisioning time. Breach of any
threshold:

- First N-σ breach → alert to on-call; signer does NOT pause.
- Second N-σ breach within the same window → auto-pause signer
  (stop issuing new signatures; in-flight are not cancelled).
- Manual unpause requires two-person review.

Metrics backend is the same stack as the bundler / paymaster specs.

## 6. Rotation schedule

- Keys are rotated on a fixed schedule — default quarterly; shorter
  for higher-value keys.
- Rotation is also triggered by any incident: posture-check fail on
  the provisioning host, a near-miss in anomaly detection, a
  personnel change on the custody team.
- Old keys are drained within a defined window, then zeroed from
  KMS.

## 7. Provenance of policy configuration

Policy configuration (thresholds, rotation cadence, partition map)
MUST come from:

- Deploy-time constants.
- A signed config entry (task 9 / TWV-2026-055 trust anchor).

User input, dApp params, deeplink query strings, and push
notifications are never policy sources.

## 8. End-user wallets are explicitly out of scope

BIP-39 multi-chain derivation from a single user seed is acceptable
in the end-user mobile wallet. Users have accepted the multi-chain
blast radius via the BIP-39 education screen (Phase 1 work). This
policy governs only **server-held / service-held** keys.

## 9. Pre-implementation checklist

Any PR that introduces a server-held signing key or provisions a new
`(chain, purpose)` key MUST:

- [ ] Cite TWV-2026-037 in the PR description.
- [ ] Show that §2 (per-chain) and §3 (per-purpose) are satisfied.
- [ ] Include the anomaly-detection thresholds (§5) tuned for the new
      key.
- [ ] Include the rotation schedule (§6) for the new key.
- [ ] Attach the two-person-review record (§4) to the PR.
- [ ] Confirm the provisioning host passed the posture check (task
      49 / TWV-2026-036).

## 10. Review gate

- `services/agent-executors/` — any PR adding server-held key handling
  MUST reference this policy.
- Any new backend surface that introduces a signer MUST include this
  checklist.

## 11. Cross-links

- Task 49 / TWV-2026-036 — dev-machine posture + OOB tx attestation.
- Task 51 / TWV-2026-039 — independence property for multi-key sets.
- Task 53 / TWV-2026-041 — paymaster policy (consumes §9 of this
  policy for paymaster-funding keys).
- Task 9 / TWV-2026-055 — EAS Update code signing; reused as the
  trust anchor for signed config.
