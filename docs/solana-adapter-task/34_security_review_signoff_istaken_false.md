# Task 34 — §10.4 invariants + shim attack-surface review + redaction proof

**Status:** Not taken
**Owner:** Security team (with mobile support)
**Spec reference:** `solana-adapter-spec.md` §10.4, §10.5 final bullet.

## Why this matters

The GA checklist's last bullet is "Security review sign-off on §10.4
invariants and on the `window.solana` shim surface." The legacy shim
is a permanent attack surface until removed; every invariant in §10.4
must be proven by an integration test firing the exact malicious
shape. This task is the audit that ratifies the work.

## Scope

Walk every row in §10.4 (23 invariants) and prove compliance:

- [ ] Inv 1: Origin / SIWS domain binding — test harness fires SIWS
      with mismatched domain; inspector annotates `danger`.
- [ ] Inv 2: Address-swap protection — test harness fires each signing
      method with `payload.address` ≠ active wallet; adapter rejects
      `4100` pre-sheet.
- [ ] Inv 3: Fee-payer trust — test harness fires tx with fee payer
      ≠ wallet; sheet renders the row; adapter never signs as fp.
- [ ] Inv 4: Durable-nonce authority check (Task 23).
- [ ] Inv 5: Lookup-table expansion (Task 10).
- [ ] Inv 6: Writable-account drain detection (Task 11).
- [ ] Inv 7: `setAuthority` / ATA close-authority hijack (Task 27).
- [ ] Inv 8: Token-2022 extension awareness (Task 14).
- [ ] Inv 9: SIWS expiry sanity (Task 09).
- [ ] Inv 10: No signer reconstruction in adapter — codereview +
      grep audit; any `createKeyPairFromPrivateKeyBytes` outside
      `services/walletService.ts` fails.
- [ ] Inv 11: Redaction on `BridgeEventBus` (Task 22 + event shape
      inspection).
- [ ] Inv 12: Session-nonce gate — already inherited from TWV-2026-015;
      smoke a forged sub-frame request.
- [ ] Inv 13: Wallet Standard wire types — covered by Task 32 lint.
- [ ] Inv 14: `supportedTransactionVersions` literal — Task 32 lint.
- [ ] Inv 15: `silent: true` error discipline — Task 04/07 unit test.
- [ ] Inv 16: No `Wallet.chains` narrowing on switch — Task 18 test.
- [ ] Inv 17: `accounts` reflects authorization not inventory —
      review Task 07 output shape.
- [ ] Inv 18: Re-injection races — Task 03 idempotent install test.
- [ ] Inv 19: No silent re-sign on blockhash expiration (Task 20).
- [ ] Inv 20: Never leak provider API keys (Task 05 + build audit).
- [ ] Inv 21: No simulation reuse across signatures (Task 11/20).
- [ ] Inv 22: SNS advisory (Task 30).
- [ ] Inv 23: Unknown program visible (Task 12/26/27/28/29).

**`window.solana` shim attack-surface review:**

- [ ] Each shim method proven to route through `bridge_request` with
      no direct RPC.
- [ ] `signIn` rejection proven — no silent `connect+signMessage`
      fallback.
- [ ] `isPhantom === false` proven — no impersonation.
- [ ] Session nonce stamp proven on every outbound message.

**Redaction proof:**

- [ ] Grep `[BridgeEvent]` logs across a full smoke-test session
      (Task 33) — no signature bytes, no private keys, no full
      message bodies.
- [ ] Agent-team sign-off on breadcrumb shape.

## Deliverables

- A sign-off report `docs/design-notes/solana-adapter-security-YYYY-MM-DD.md`
  listing each invariant with "✅ Proof: <test name | review note>".
- Any open bug blocks GA.

## Rules (non-negotiable)

- **Every invariant has a proof.** Not just a test — a *specific*
  test citing the invariant it enforces.
- **Shim is a permanent attack surface.** Document what it exposes
  and what's explicitly off (`signIn`, direct RPC).
- **Redaction proved by grep**, not by inspection — automated scan
  of the log corpus from Task 33.

## Acceptance

- [ ] Sign-off report written, every row has a proof.
- [ ] Security-team reviewer has signed.
- [ ] Outstanding bugs resolved or explicitly scoped out of GA with
      product acknowledgement.

## Out of scope

- TWV-2026-070 signer dwell re-audit — already covered by
  `solana-chain-support-spec.md` Task 27 security design note.
