# Smart-account audit checklist

**Spec reference:** `wallet-security-vulnerabilities-spec.md`
TWV-2026-044 (task 56). Companion: TWV-2026-045 (task 57, ERC-7562),
TWV-2026-041 (task 53, paymaster policy), TWV-2026-042 (task 54,
multi-bundler).

**Status:** Design-property / audit-checklist. No smart-account signing
code ships today. This document is the contract any account contract
— and any wallet-client signing path that produces a UserOperation —
must meet before it can be added to the supported list.

## Pre-implementation checklist (merges block on any unchecked box)

Applies to each account contract added to the supported list, and to
the wallet-client signing code that produces UserOps.

- [ ] `getUserOpHash(userOp)` binds `entryPoint` + `chainId` + every
      field of the struct (§1).
- [ ] ECDSA `s` is normalised to the low half of `N` before submission
      (§2).
- [ ] Account contract rejects `validateUserOp` from any EntryPoint
      other than the one it is pinned to (§3).
- [ ] Test-vector validation runs once per account and is cached;
      mismatch marks the account untrusted (§4).
- [ ] PRs adding UserOp signing cite this task (TWV-2026-044) and
      re-run the test-vector validation locally.

## 1. UserOp hash binding

`getUserOpHash(userOp)` — both the client-side re-derivation and the
account contract's view function — MUST be equivalent to:

```
keccak256(abi.encode(
  packedUserOp,    // every field of UserOperation, in struct order
  entryPoint,      // address of the EntryPoint that will execute
  chainId
))
```

Where `packedUserOp` includes every struct field, including
`paymasterAndData`, `initCode`, `signature` length byte prefix, and
`callData`. Omission of any field is a blocking bug.

Concrete failures we refuse to ship:

- Account contracts whose `getUserOpHash` predates EntryPoint v0.6 and
  omits `chainId`. These allow cross-chain replay. If the reference
  implementation we adopt does this, we patch or choose a different
  account.
- Wallet-side code that computes a digest locally and diverges from
  the account contract's view. Prevention: §4 test-vector validation.

## 2. ECDSA `s`-value normalisation (EIP-2)

Before submitting a UserOp, the wallet MUST normalise the signature's
`s` value to the low half of `secp256k1`'s order `N`. High-`s`
signatures are malleable — the same message has two valid `(r, s)`
pairs.

### 2.1 Client-side enforcement

```
// Viem's default signing path already produces low-s. Verify anyway.
// Reject if s > N/2.
```

The wallet client does this regardless of whether the account contract
enforces it. We do not depend on the contract alone.

### 2.2 Contract-side enforcement

The account contract's `validateUserOp` MUST also reject high-`s`
signatures via the `ecrecover` path that checks `s` ≤ `N/2` — or use
OpenZeppelin's `ECDSA.recover` which already rejects malleable
signatures. Accounts that do not enforce this are not added to the
supported list.

## 3. EntryPoint pinning

Each account contract supports **one** EntryPoint address (or a
documented upgrade path). `validateUserOp` reverts when the caller is
not the pinned EntryPoint.

- Old EntryPoint versions are deprecated on a published schedule. The
  wallet tracks which account uses which EntryPoint version and warns
  on version skew: "This account was created for EntryPoint v0.6;
  newer versions have additional validation. Consider rotating."
- The wallet refuses to submit a UserOp to an EntryPoint the account
  does not claim. No silent multi-version fallback.

## 4. Test-vector validation

At account-creation time (and on each app upgrade that changes the
packing), the wallet:

1. Constructs a known UserOp (`sender = this account`, fixed
   `callData`, fixed `nonce`).
2. Calls `getUserOpHash(userOp)` on-chain (free view call).
3. Locally re-derives the same hash using the wallet's packing code.
4. Compares. Mismatch marks the account as **untrusted** —
   `signUserOp` returns an error rather than producing a signature.

Caching:

- Result is cached per `(chainId, accountAddress, entryPointAddress,
  appVersion)`. Cache is invalidated on app upgrade so we re-validate
  after any packing-code change.
- A failed validation is also cached (so we do not re-prompt the user
  on every app open). User can "retry validation" from the account
  details screen.

## 5. Deprecation schedule

- EntryPoint versions we support: v0.6, v0.7 (add v0.8 when ERC-7562
  conformance is confirmed — see task 57).
- Deprecation lead time: 6 months between "support added" and "old
  version flagged as warn". 12 months between "warn" and "disable new
  account creation on that version".
- Deprecation status is surfaced in the account details screen.

## 6. Review gate

- Any PR that adds UserOp signing to `services/walletService.ts` (or a
  new module) MUST reference TWV-2026-044 in the PR description,
  include the §4 test-vector validation, and confirm the §1 + §2 + §3
  invariants.
- Any PR that adds an account contract to the supported list MUST
  attach the audit report for that contract, and confirm the audit
  covered §1–§5.

## 7. Cross-links

- Task 57 / TWV-2026-045 — ERC-7562 validation rules on paymaster /
  bundler; the paymaster must pass test vectors similar in spirit to
  §4 before we use it.
- Task 58 / TWV-2026-046 — HW-pairing attestation; when HW-signed
  UserOps become possible, the RFC 6979 + aux-entropy requirement
  applies here too.
- Task 62 / TWV-2026-057 — native-signing design; the UserOp signing
  path is a future consumer of `TakumiSigner`.
