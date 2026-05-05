# Task 15 — Telemetry: `chain=sui` Sentry tags + per-method timers

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §13 (task 15).

## Why this matters

When the bridge ships (Task 20) and the first Sui dApp incident lands,
we need to be able to filter `chain=sui` in Sentry and pull per-method
latency / error rates the same way we do for EVM / Solana. The
`bridgeEventBus` is the seam — telemetry sinks subscribe to it and
emit per-namespace tags.

## Scope

- Find every `bridgeEventBus` consumer (Sentry breadcrumb formatter,
  Console sink, agent-API breadcrumb writer if present) and ensure each
  reads `intent.namespace` / `req.namespace` to tag with `chain=sui`.
- Add per-method timers for the seven Sui wire methods:
  `standard:connect`, `standard:disconnect`, `sui:signPersonalMessage`,
  `sui:signTransaction`, `sui:signAndExecuteTransaction`,
  `sui:reportTransactionEffects`, `takumi:switchNetwork`.
- Mirror Solana timer naming: `bridge.method.<method_with_dots_to_underscores>.duration`.
- Verify Sui method branches in `redactParams` (Task 17) keep telemetry
  payloads secret-free.

## Rules (non-negotiable)

- **No code changes in `SuiAdapter.ts`.** This task only touches sinks /
  consumers downstream of `bridgeEventBus`.
- **Tag namespace, not chain id.** `chain=sui` (the namespace) — not
  `chain=sui:mainnet` (the chain id). The chain id is a separate tag /
  field.
- **Legacy aliases tag with the rewritten method name** (`sui:signTransaction`,
  `sui:signAndExecuteTransaction`) — not their legacy form. Otherwise
  dashboards split metrics across alias/canonical and show false
  flatlines.

## Acceptance

- [ ] Sentry breadcrumbs from a stubbed Sui sign show `chain=sui` tag.
- [ ] Per-method timer keys present for all seven methods (asserted via
      sink-level test).
- [ ] EVM / Solana telemetry unchanged.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Sentry dashboard configuration (ops-side).
- Adapter code changes.
