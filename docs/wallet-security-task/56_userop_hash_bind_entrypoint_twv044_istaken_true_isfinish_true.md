# Task 56 — UserOp hash binds EntryPoint + chainId; ECDSA `s` normalised

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** wallet-security-vulnerabilities-spec.md TWV-2026-044, §7, §9

## Why this matters

Early ERC-4337 account implementations shipped `getUserOpHash`
functions that omitted the EntryPoint address, the chainId, or parts of
the UserOp struct. Signatures collected for EntryPoint v0.6 could then
be replayed against the same account on EntryPoint v0.7, or across
chains. ECDSA `s`-value malleability (pre-EIP-2 behaviour) adds a
second replay vector. TakumiAI will eventually sign UserOps; the
wallet-client contract has to refuse any signing preimage that omits
these bindings.

## Scope

Design-property / audit-checklist task. Deliverables:

- Write a new entry in `docs/smart-account-audit-checklist.md` (create
  if absent) that lists, for each account contract the wallet will
  support:
  - `getUserOpHash(userOp)` must include `entryPoint`, `chainId`, and
    every field of the `UserOperation` struct including
    `paymasterAndData` and the byte-length of `signature`.
  - ECDSA `s` must be normalised to the low half of `N` (EIP-2) before
    `ecrecover`; high-`s` signatures are rejected.
  - The account contract hard-codes a single EntryPoint address and
    rejects `validateUserOp` calls from any other EntryPoint.
  - Test-vector validation: at account-creation time, the wallet
    performs a read-only `getUserOpHash` call against a known input
    and compares to the locally re-derived hash; mismatch blocks
    account use.
- Add to `services/walletService.ts` a pre-implementation note: when
  the smart-account signing path is built, the wallet client MUST
  reject any `eth_signUserOp`-equivalent request whose preimage does
  not include the EntryPoint address. Signature is over
  `keccak256(entryPoint || chainId || packedUserOp)`, no shortcuts.
- Flag TWV-2026-044 as a review gate. Any PR that adds UserOp signing
  must cite this task and include the test-vector validation.

## Rules (non-negotiable)

- No smart-account signing flow bypasses the EntryPoint + chainId
  binding; omission is a blocking bug.
- ECDSA `s` normalisation is done on the wallet side before submission;
  the wallet does not rely on the account contract alone.
- Old EntryPoint versions are deprecated on a published schedule; the
  wallet tracks which account uses which EntryPoint and warns on
  version skew.
- Test-vector validation runs once per account and is cached; a failed
  validation marks the account as untrusted.

## Acceptance

- [ ] `docs/smart-account-audit-checklist.md` exists with the four
      rules.
- [ ] `services/walletService.ts` pre-implementation note present
      (design comment only — no code change in this task).
- [ ] Review gate recorded; smart-account roadmap entry cross-links.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Implementing UserOp signing.
- Choosing an account-contract vendor / reference implementation.
- Auditing specific EntryPoint versions (those audits are their own
  upstream work; we consume the results).
