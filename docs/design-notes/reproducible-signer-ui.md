# Reproducible signer UI (for future multisig / custody flows)

**Spec reference:** `wallet-security-vulnerabilities-spec.md`
TWV-2026-034 (task 48). Companion: TWV-2026-033 (task 25, Safe tx-hash
re-derivation), TWV-2026-008 (task 8, Permit/Permit2 decoding),
TWV-2026-038 (task 27, claim-label vs delta mismatch).

**Status:** Pre-implementation design note. No multisig or custody
"approve-as-a-team" feature ships in Takumi today. This document is
the contract that any such feature MUST satisfy before it can be
added.

The WazirX loss (July 2024, ~$230M) is the worked example: Liminal's
custody UI displayed a benign Safe transaction while the signed
payload actually rewrote the multisig's implementation. Hardware
wallets couldn't save the signers — Safe calldata does not render
meaningfully on Ledger-class screens, so operators blind-signed a
drain. The single point of compromise was the UI layer. The fix is to
make the UI **reproducible**: the hash the user signs must be
independently verifiable from the raw payload alone, without trust in
any remote service.

## 1. Pre-implementation checklist (merges block on any unchecked box)

Applies to any PR that introduces a multisig, custody, or
"approve-as-a-team" signing feature. Includes in-app multisig flows,
Safe integrations, and any future enterprise-treasury surface.

- [ ] Signed hash rendered in-UI is re-derivable from the raw payload
      alone (§2). No trust in remote services.
- [ ] Calldata decoding is in-process, sourced from on-chain bytecode
      of the target contract, via a pinned RPC call (§3). Never from
      the dApp or the custody backend.
- [ ] For Safe-style multisigs, the Safe tx hash is independently
      re-derived and cross-checked against Safe Transaction Service
      (§4). Cross-link task 25 / TWV-2026-033.
- [ ] Sensitive-selector runbook: `changeImplementation`,
      `upgradeTo`, `setGuard`, `setFallbackHandler`, and equivalents
      trigger a mandatory hash-match step (§5).
- [ ] Reproducibility test covering the WazirX pattern passes in CI
      (§6).
- [ ] Second-device verification path documented (§7).

## 2. Reproducible signed hash

Every signer UI — the wallet's own multisig view, the Safe
integration, any future "approve-as-a-team" flow — MUST render the
exact tx hash (or UserOp hash, or Safe tx hash) that will be signed.

- The hash is re-derived from the raw tx / UserOp / Safe payload
  inside the app process. No call to a backend "give me the hash I
  should show" endpoint.
- The derivation must be deterministic: two runs of the same app
  version against the same payload produce the same hash, byte-for-
  byte. This is what `TWV-2026-034` means by "reproducible."
- If the signer is a hardware wallet that can display the hash on its
  own screen, the app compares its derived hash to what the HW
  reports. Mismatch blocks signing.

This rule is the entire point of the task. Any path that computes the
hash server-side and ships it to the app has re-introduced the WazirX
failure mode.

## 3. In-process calldata decoding

Calldata decoding must be in-process. The ABI used to decode comes
from one of:

- The target contract's on-chain bytecode, via a pinned RPC call
  against the deployed address — e.g., `eth_getCode` + registry-
  derived ABI.
- A bundled-at-build-time ABI for well-known contracts (Uniswap
  Universal Router, Permit2, Safe).

Calldata decoding MUST NOT come from:

- The dApp's own JSON description of the tx.
- The custody backend's rendered summary.
- A remote "decode this for me" service whose trust model is not
  owned by the wallet.

`services/decoders/calldata.ts` is the home for this decoder; when
multisig work starts, its ABI resolution path must be strict.

## 4. Safe tx-hash cross-check

Cross-link: task 25 / TWV-2026-033. Any Safe-adjacent signing UI MUST:

- Re-derive the Safe tx hash locally from the payload's fields
  (`to`, `value`, `data`, `operation`, `safeTxGas`, `baseGas`,
  `gasPrice`, `gasToken`, `refundReceiver`, `nonce`, Safe address,
  chainId).
- Cross-check against Safe Transaction Service's value for the same
  `safeTxHash`.
- Mismatch blocks signing with clear copy: "The Safe service returned
  a different hash for this transaction than what we computed locally.
  Do not sign. File with Safe support."

## 5. Sensitive-selector runbook entry

Any tx invoking any of these selectors on a Safe, the account
contract, or an upgradeable proxy triggers a mandatory hash-match
step:

- `changeImplementation(address)` / `upgradeTo(address)` /
  `upgradeToAndCall(address,bytes)` — implementation swap.
- `setGuard(address)` — installs a guard that can veto future txs.
- `setFallbackHandler(address)` — changes the contract the account
  delegates unknown calls to (the WazirX pattern).
- `addOwner`, `removeOwner`, `swapOwner`, `changeThreshold` — owner
  set modifications.
- `executeCall(delegatecall, …)` where `delegatecall = true` — same
  risk as implementation swap (cross-link task 25).

The hash-match is:

- User sees the computed tx hash.
- User's hardware device displays its own hash.
- The two are compared byte-for-byte before the HW releases the
  signature.

Operational runbook (separate document when multisig lands):
"Sensitive selectors detected — hash-match required before sign."

## 6. Reproducibility test (CI)

The test suite for the future multisig feature MUST include:

- **WazirX regression vector:** a Safe tx whose `callData` invokes
  `setFallbackHandler(addr)` but whose *displayed summary* would
  have read as a benign transfer in a naive UI. The test asserts that
  Takumi's signer UI surfaces the sensitive-selector warning, renders
  the derived hash, and blocks a mismatched-hash sign.
- **Same-payload determinism:** run the hash derivation twice; assert
  byte-equal results.
- **Safe TX Service stub mismatch:** mock the Safe service to return
  a wrong hash; assert the UI blocks the sign.
- **Unknown-selector default:** a sensitive-looking selector that is
  not in the runbook still renders the full decoded calldata; copy
  does not default to "looks fine" on the basis of a missing ABI.

## 7. Second-device verification

For power users and high-value signs:

- The signer device (the phone, or the HW wallet) displays a QR
  encoding the signed-tx hash and the decoded calldata summary.
- A secondary device (a different phone, a dedicated air-gapped
  scanner, a paper reference) reads the QR and shows the asset
  deltas independently of the signing app.
- Users running above a documented threshold are prompted to run
  this check.

This path is advisory (users can skip it) but it exists so
high-value operators have an independent verification path.

## 8. Review gate

- Any PR that introduces a multisig, custody, "approve-as-a-team",
  or operator-signing feature MUST cite TWV-2026-034 and tick every
  box in §1.
- Cross-reference: `docs/multisig-spec.md` §5, which consumes this
  note when the multisig feature lands.
- PR template prompt: "touches multisig / custody / operator
  signing? cite TWV-2026-034."

## 9. Cross-links

- Task 25 / TWV-2026-033 — Safe tx-hash re-derivation.
- Task 8 / TWV-2026-008 — Permit/Permit2 decoding.
- Task 27 / TWV-2026-038 — claim-label vs simulated-delta mismatch
  warning. Reproducible UI + simulation catch different failure
  modes; both are required.
- Task 56 / TWV-2026-044 — UserOp hash binding (EntryPoint + chainId)
  for smart-account multisig.
