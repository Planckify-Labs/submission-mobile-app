# Task 22 — Boot wiring + `services/bridge/redact.ts` Solana branch

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §5, §10.4 inv 11.

## Why this matters

Phase 1b ends with "everything registered at boot, redaction
proven." Registering inspectors and signer wiring has to happen
exactly once; redacting payloads before `BridgeEventBus` emission
is a hard security invariant — the agent must never see a signed
message body, signature, or private key material even via audit
logs.

## Scope

- `services/bridge/boot.ts`:
  - Register the three inspectors from Tasks 09, 11, 12:
    `SolanaSiwsInspector`, `SolanaSimulationInspector`,
    `SolanaProgramDecoderInspector`.
  - Pass `rpcSubscriptions` factory (Task 05) to
    `installSolanaSigner` so WS confirmation works when env is set.
  - Order: `SolanaProgramDecoder (15)` runs before
    `SolanaSimulation (20)` which runs before `SolanaSiws (20)` —
    priorities handle ordering; registration order is cosmetic.
- `services/bridge/redact.ts` — add Solana branch:
  - `solana:signMessage` → `{ length, preview: first16Chars,
    cluster }`. Replaces the payload before `BridgeEventBus.emit`.
  - `solana:signTransaction` / `solana:signAndSendTransaction` →
    `{ version, feePayer, writableAccountCount, cluster }`. Never
    the base64 tx.
  - `solana:signAllTransactions` → per-tx redaction, same shape.
  - `solana:signIn` → `{ domain, issuedAt, expirationTime, chainId }`
    — never `signature`, never `signedMessage`.
  - `takumi:switchCluster` / `takumi:watchToken` → no redaction
    needed (no secrets in payload), pass through.
- `services/bridge/redact.test.ts` — fixture payloads; assert
  redacted shape does not contain signature / private key / seed /
  full message bytes.

## Rules (non-negotiable)

- **No signature bytes on the bus.** Invariant 11. Ever. Breadcrumbs
  carry structural fields only.
- **No seed / private-key material.** Already enforced by TWV-2026-070
  in `walletService.ts`; this task covers the bridge-bus side.
- **Register-once discipline.** Double-registration of an inspector
  produces double-patches. Boot wires each exactly once; idempotent
  re-call is a no-op (existing bridge contract).
- **Dev-build breadcrumbs use the same redactor.** `__DEV__` is not
  an exception; redaction runs in all build modes.

## Acceptance

- [ ] `bootBridge()` registers three inspectors + signer factory in
      one call.
- [ ] Redact fixture tests: every Solana event shape proven free of
      signature / message bytes.
- [ ] Dev-build log scrub: grep `BridgeEventBus` logs for a devnet
      signMessage round-trip; no full message body present.
- [ ] Agent team review on the emitted event shape signs off.

## Out of scope

- Agent-API consumers of the breadcrumbs (separate spec).
