# Task 01 — Hard-reject `eth_sign` at the bridge

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-007, §7 (non-regression), §9 (DiD checklist rows)

## Why this matters

`eth_sign` signs an arbitrary 32-byte hash with no structured-data display,
so any dApp that reaches it can trick the user into signing a transaction
hash (e.g. the keccak256 of a USDC `transfer` to the attacker) under the
guise of "login". The bridge router in `services/bridge/DappBridge.ts`
today dispatches injected-provider requests by method name — if `eth_sign`
is reachable there, every embedded dApp and WalletConnect session is one
prompt away from a blank-check signature. The §9 "Signatures" checklist
requires `eth_sign` to be hard-rejected before the next release.

## Scope

1. In `services/bridge/DappBridge.ts`, route `eth_sign` to a terminal
   rejection branch that returns `{ code: 4200, message: 'eth_sign is
   deprecated and unsupported' }` (EIP-1193 "Unsupported Method"). Do
   not call any signer UI, do not record an approval intent.
2. Apply the same rejection to any alias the bridge currently accepts
   (`eth_signRaw`, vendor-prefixed variants) — grep the bridge for
   method strings.
3. Ensure `personal_sign` and `eth_signTypedData_v4` paths are
   untouched; they remain the only sanctioned signing methods.
4. Extend `services/bridge/inspectors/` (or add one inspector) so the
   rejection is logged to the in-app activity sink with the origin for
   later triage. No seed-like material is logged (see TWV-2026-003).

## Rules (non-negotiable)

- **Precise predicate, not heuristic.** Reject exactly `eth_sign` (and
  explicit aliases). Do not block `personal_sign` or `eth_signTypedData*`
  under any regex that could fire on them.
- **Rejection is terminal.** No user prompt, no "advanced user override",
  no settings toggle that re-enables it.
- **Error shape is EIP-1193.** `code: 4200`, `message` fixed string.
  dApps parsing `providerRpcError` must still see a well-formed object.
- **Signable-tx parity (§7).** All other signable methods continue to
  work unchanged; no transaction type regresses.

## Acceptance

- [ ] `services/bridge/DappBridge.ts` rejects `eth_sign` with code 4200
      before any approval intent is created.
- [ ] Unit test in `services/bridge/DappBridge.test.ts` (or the closest
      existing test file) asserts the rejected error shape for
      `eth_sign` and that `personal_sign` + `eth_signTypedData_v4`
      still resolve normally.
- [ ] A rejection event is surfaced through existing bridge event
      plumbing (`services/bridge/events.ts`) with origin tagged.
- [ ] Manual regression: connect to one dApp that still calls
      `eth_sign` (e.g. an older test fixture) and confirm it sees the
      error; re-sign a `personal_sign` login and an EIP-712 permit on
      the same session to confirm unaffected.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Adding a scam-domain feed to pre-flag dApps that attempt `eth_sign`
  (tracked in Phase 2 / TWV-2026-051).
- Changing the `personal_sign` UTF-8 rendering or hex-lookalike
  warning (tracked separately in the §9 Signatures row).
- WalletConnect v2 session storage hardening (TWV-2026-030).
