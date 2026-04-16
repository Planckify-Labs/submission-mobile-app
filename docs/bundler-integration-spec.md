# Bundler integration spec

**Spec reference:** `wallet-security-vulnerabilities-spec.md`
TWV-2026-042 (task 54). Companion: TWV-2026-041 (task 53, paymaster
policy), TWV-2026-045 (task 57, ERC-7562 validation rules),
TWV-2026-050 (task 28, Flashbots Protect default for swaps).

**Status:** Design-property spec. No bundler client ships today. This
document is the pre-implementation contract — any PR that introduces a
smart-account / UserOp submission path must satisfy every rule below
before it can merge.

## Pre-implementation checklist (merges block on any unchecked box)

- [ ] ≥ 2 independent bundler vendors configured per supported chain
      (§1). No single-bundler deploys.
- [ ] Independence property from task 51 / TWV-2026-039 checked at
      vendor selection time.
- [ ] `services/rpc/` (or the Phase-2 replacement) generalised to
      treat bundler URLs as typed records (§2).
- [ ] Submission protocol with fallback + timeout wired in (§3).
- [ ] Observability: per-bundler inclusion-latency metric (§4).
- [ ] MEV-sensitive UserOps default to private-mempool / Flashbots-
      equivalent path (§5).
- [ ] Paymaster signatures remain valid across bundler retries (§6).
- [ ] Bundler list is deploy-time constants or signed remote config;
      never dApp-controlled (§7).
- [ ] ERC-7562 validation-rule enforcement is a hard vendor
      requirement (§8, cross-link to task 57).

## 1. Minimum redundancy

Each supported chain MUST have **two or more** independent bundler
vendors configured. "Independent" per `docs/multisig-independence-spec.md`
(task 51) — candidates:

- Different operator company.
- Different cloud infra (not both on AWS us-east-1).
- Different admin / ops team (so a single compromised ops account
  cannot censor both).

Current candidate vendor pool (public documentation referenced at time
of writing): Pimlico, Alchemy, Stackup, Candide. Selection finalised
per chain at integration time.

Single-bundler deploys are not allowed in production. A deploy is
blocked by the checklist here.

## 2. Bundler URLs as typed records

`services/rpc/` today treats RPC URLs as strings. The bundler story
does not fit that shape. Generalise to a typed record:

```ts
interface BundlerEndpoint {
  url: string;
  vendor: "pimlico" | "alchemy" | "stackup" | "candide" | string;
  chainId: number;
  entryPoint: `0x${string}`;
  slaPolicy: {
    expectedInclusionBlocks: number;
    failureBudgetMinutes: number;
  };
  privateMempool: boolean;
}
```

Rules:

- `entryPoint` must match the bundler's advertised EntryPoint for that
  chain. Mismatch = reject at config-load time.
- `url` is not user-editable; it is a deploy-time constant or a signed
  remote-config entry.
- A bundler endpoint whose TLS certificate fails SSL/SPKI pinning (task
  23 / TWV-2026-026) is not used.

## 3. Submission protocol

Submit-with-fallback:

1. Try bundler A. Wait up to `slaPolicy.expectedInclusionBlocks`
   blocks observed via our own RPC.
2. If not included and `eth_getUserOperationReceipt` returns null,
   retry via bundler B. Same wait.
3. If all bundlers time out, show the user "Your transaction has not
   yet been included. Retry, or use a different submission path." Do
   not silently re-sign — the user consented to submit once.

Retry semantics:

- UserOp signature is bound to `(entryPoint, chainId, nonce)`. A retry
  MUST NOT change any of those. If a bundler requires a new nonce,
  that is a new user consent — ask first.
- Paymaster signatures that are bundler-specific (if the paymaster
  co-signs) require the paymaster-sponsor layer to issue a new
  paymaster signature for the retry. See §6.

## 4. Observability

Per-bundler metric:

- Inclusion latency (submit → included block number).
- Rejection rate with reason tags (insufficient funds, replacement
  underpriced, etc.).
- Outage detection: P95 inclusion latency deviating from the SLA for
  > `slaPolicy.failureBudgetMinutes` triggers an on-call alert and,
  in-app, an automatic fallback to next-preference bundler.

Metric backend: whichever our observability stack provides (Sentry /
OpenTelemetry / internal). The spec is the metric *definition*, not
the backend choice.

## 5. MEV-sensitive UserOps

Routes:

- **Swaps, liquidations, anything with slippage** → private path
  (Flashbots Protect, MEV Blocker, or protocol-native batcher such as
  CoW) unless the user explicitly opts into public.
- **Transfers, calls with no MEV surface** → default bundler path is
  fine.

Cross-link: task 28 / TWV-2026-050 (Flashbots Protect default).

Classification of a UserOp as MEV-sensitive is based on
`callData` decoder output (router addresses, known selectors). The
decoder lives in `services/decoders/calldata.ts`; the classifier is
exercised at simulation time (task 17 / TWV-2026-011).

## 6. Paymaster compatibility across retries

Paymaster sponsorship signatures are typically bound to
`(sender, nonce, validUntil, validAfter, maxFeePerGas,
maxPriorityFeePerGas)`. A bundler retry must not invalidate the
signature.

Design rules:

- The sponsorship backend issues a signature with generous validity
  window (e.g., 20 minutes) so a bundler retry within the window does
  not require a new signature.
- If a retry requires changing `maxFeePerGas` (gas-price spike during
  the retry window), the client re-requests a paymaster signature
  rather than retrying blindly. The user consents to the new fee
  before re-submission.

Cross-link: task 53 / TWV-2026-041 (paymaster policy).

## 7. Provenance of the bundler list

The bundler list MUST come from one of:

- Deploy-time constants in the shipped bundle.
- A signed remote-config entry verified against the EAS Update code-
  signing certificate (task 9 / TWV-2026-055).

A bundler advertised by a dApp, a deeplink, a push notification, or
any remote source the wallet does not cryptographically authenticate
is NEVER used. This is a hard rule — there is no override.

## 8. ERC-7562 enforcement (cross-link task 57)

Any bundler we ship with MUST enforce ERC-7562 validation rules in
pre-bundle simulation:

- No forbidden opcodes (`GAS`, `GASPRICE`, `TIMESTAMP`,
  `BLOCKHASH`, etc. per the spec) in restricted phases.
- No banned storage-slot access during validation.
- Tight gas bounds honoured.

The bundler vendor's written confirmation of ERC-7562 enforcement is
part of the integration-acceptance checklist. Non-conforming vendors
are rejected regardless of commercial terms.

## 9. Review gate

- `services/rpc/` — any PR that adds UserOp submission MUST reference
  TWV-2026-042 and re-check §1–§8.
- Deploy config — any PR that adds / removes a bundler endpoint MUST
  include the independence evaluation from task 51.

## 10. Cross-links

- Task 51 / TWV-2026-039 — independence property for multi-bundler
  (and multi-paymaster, multi-guardian) sets.
- Task 53 / TWV-2026-041 — paymaster policy; paymaster + bundler are
  co-reviewed.
- Task 57 / TWV-2026-045 — ERC-7562 validation rules.
- Task 28 / TWV-2026-050 — Flashbots Protect default for swaps.
- Task 23 / TWV-2026-026 — SSL/SPKI pinning on all backend + RPC /
  bundler hosts.
