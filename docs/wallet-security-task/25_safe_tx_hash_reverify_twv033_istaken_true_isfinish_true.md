# Task 25 — Independent Safe tx-hash re-derivation + `delegatecall` hard-warn

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-033, §7, §9

## Why this matters

Bybit lost ~$1.46B because Safe signers trusted a compromised dApp
frontend to tell them what they were signing. Hardware wallets only
showed `delegatecall` + an opaque hash. The lesson generalises: any
tx payload surfaced by a dApp must be independently re-decoded and
hash-verified inside the wallet before a signature is produced.
`operation == 1` (`delegatecall`) in Safe payloads is almost always
the actual attack surface and must be hard-warned.

## Scope

- Extend `services/bridge/DappBridge.ts` (or its equivalent router) so
  every `eth_sendTransaction` / typed-data tx targeting a Safe-shaped
  payload is re-decoded from raw fields locally. Do not trust
  `params[0]` verbatim.
- Add a Safe tx-hash re-derivation helper (new module under
  `services/decoders/` — see spec §9) that computes the Safe domain
  separator + message hash from `(to, value, data, operation,
  safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce)` and
  the Safe address + chainId.
- Re-fetch the target contract's deployed bytecode via a pinned RPC
  (see spec §9 pinning notes) and use the on-chain ABI, not any
  dApp-supplied ABI, for decoding.
- Signer UI: when `operation == 1`, render a full-width red banner
  (`delegatecall` — contract upgrade / arbitrary code) and disable the
  Sign button for a 3-second cool-down.
- Expose the independently-computed Safe tx hash in the signer UI so
  the operator can out-of-band compare it against Safe Transaction
  Service.

## Rules (non-negotiable)

- Never display a tx summary derived solely from dApp-supplied fields
  — decode must root in on-chain bytecode.
- `operation == 1` requires an explicit extra confirmation gesture;
  no single-tap path.
- The computed Safe tx hash displayed to the user MUST equal the hash
  the signer device would produce; unit tests pin this against EIP-712
  vectors.

## Acceptance

- [ ] Unit tests cover Safe tx-hash re-derivation against known vectors
      (mainnet Safe v1.3 and v1.4 domain separators).
- [ ] Any inbound tx with `operation == 1` triggers the red banner +
      cool-down in the signer UI.
- [ ] The signer UI displays the locally-computed Safe tx hash
      verbatim; a manual test confirms it matches Safe Transaction
      Service for a sample tx.
- [ ] dApp-supplied ABI / field hints are never used — grep shows
      decoders read only from the pinned RPC.
- [ ] Regression: non-Safe `eth_sendTransaction` flows unchanged.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Shipping full Safe multisig UX (we do not host Safes today).
- Signer ceremony tooling (out-of-band chat channels, comparison UIs).
- Integration with a remote Safe Transaction Service client (Phase 3).
