# Task 17 — `services/bridge/redact.ts` Sui branches

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §11.5.3.

## Why this matters

Every intent that flows through `bridgeEventBus` is shown to telemetry
sinks (Console today, Sentry tomorrow). Without Sui-aware `redactParams`
branches, raw transaction BCS bytes / signed-message bytes / signatures
end up in breadcrumbs. The Solana branches at `redact.ts:174-249` set
the bar — Sui must match.

## Scope

Add to `services/bridge/redact.ts:130-255` the four method branches per
§11.5.3:

- **`sui:signPersonalMessage`**: keep `address`, `messageLength`,
  `messagePreview` (16-char cap). Drop everything else.
- **`sui:signTransaction` / `sui:signAndExecuteTransaction` /
  `sui:signTransactionBlock` / `sui:signAndExecuteTransactionBlock`**
  (current + both legacy aliases): keep `address`, `chain`,
  `txBytes` (length only), `hasOptions`. Drop `transaction`, `options`
  contents.
- **`sui:reportTransactionEffects`**: keep `address`, `chain`,
  `effectsBytes` (length only). Drop the effects payload.
- **`takumi:switchNetwork`**: pass through intact (no secrets).
- `standard:connect` and `standard:disconnect` are universal — the
  existing Solana branch at `:242-249` already covers Sui without
  changes. Verify by test, do not duplicate the branch.

Add tests to `services/bridge/redact.test.ts`:
- Each branch above strips the correct fields.
- Legacy aliases redact identically to their current counterparts.
- Universal `standard:connect` branch handles Sui without modification.

## Rules (non-negotiable)

- **`messagePreview` cap is exactly 16 chars** — same property
  `agentContext.ts` (Task 16) enforces. Two different caps would split
  the privacy posture.
- **No `transaction` field in redacted output.** Length only.
- **Legacy aliases must redact** — even though the adapter rewrites
  them, the bridge sees the original method name on the wire.
- **Pass-through for `takumi:switchNetwork`** — but assert in a test that
  no future-added field accidentally leaks (defensive snapshot test).

## Acceptance

- [ ] Six test cases above green (signPersonalMessage, four
      signTransaction variants, reportTransactionEffects).
- [ ] `takumi:switchNetwork` snapshot test green.
- [ ] EVM + Solana redaction tests unchanged.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- `agentContext.ts` (Task 16).
- Telemetry sink wiring (Task 15).
