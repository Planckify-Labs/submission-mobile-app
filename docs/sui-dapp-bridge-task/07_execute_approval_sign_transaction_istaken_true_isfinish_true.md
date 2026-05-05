# Task 07 — `SuiAdapter.executeApproval` for `signTransaction` (sign-only + sign-and-execute)

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §4.4 (signTransaction rows), §1.4, §6 (`SuiSignTxPayload`, `SuiTxOptions`).

## Why this matters

This is the highest-stakes path in the bridge — every dApp that signs a
PTB lands here. The sign-only and sign-and-execute branches share the
sign step; only the post-sign path differs (return signed bytes vs
submit + return digest/effects).

## Scope

Implement in `services/chains/sui/SuiAdapter.ts`'s `executeApproval`
the `signTransaction` branch, dispatching on `payload.mode`:

- **`mode: "sign-only"`**:
  - Call `SuiSignerFns.signTransaction(address, payload.transaction)`.
  - Return `{ bytes: <base64 BCS>, signature: <base64 97-byte> }` per §4.4.
- **`mode: "sign-and-execute"`**:
  - Call `SuiSignerFns.signAndExecuteTransaction(address, payload.transaction,
    payload.network, payload.options ?? { showEffects: false })`.
  - Return `{ digest, rawEffects?, rawTransaction? }` shape per §4.4 — the
    `client.executeTransactionBlock` response under the requested options.
- Error mapping:
  - User reject → `4001`.
  - No grant → `4100`.
  - Invalid base64 / decode failure → `-32602`.
  - Submission failure (e.g. sponsored tx missing sponsor sig per §14
    risk row 5, gas exhaustion) → `-32603` with the SDK error message
    forwarded in `data.detail`.

## Rules (non-negotiable)

- **`bytes` echoes the input transaction.** Do NOT re-serialise — round-
  tripping through `Transaction.from()` and back can change BCS encoding
  for some payloads. The dApp expects the exact bytes it sent back.
- **Signature is base64 verbatim from the keypair.** No double-encoding
  (§1.4 row 2). 97 bytes after decode: `flag(1)||sig(64)||pubkey(32)`.
- **`payload.options` defaults to `{ showEffects: false }`** when the dApp
  omits it. Many dApps ignore the response anyway and we don't pay the
  RPC cost to materialise effects they discard.
- **Sponsored transactions:** `executeTransactionBlock` will reject if
  the sponsor signature is missing — surface the SDK error verbatim.
  The adapter never invents a sponsor signature.
- **No private material logged.**

## Acceptance

- [ ] Sign-only path: signature verifies via
      `verifyTransaction({transaction: bytes, signature})` from
      `@mysten/sui`.
- [ ] Sign-and-execute path: against a mocked `SuiClient`, the right
      `executeTransactionBlock` shape is called with the right options.
- [ ] Submission failure surfaces `-32603` with `data.detail`.
- [ ] User-reject path returns `4001`.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- PTB decoding / simulation (Tasks 08, 09).
- Sheet rendering (Task 11).
- `dryRunTransactionBlock` (Task 09).
