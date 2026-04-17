# Task 10 — `altResolver.ts` — Address Lookup Table expansion

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §4.9, §10.2, §10.4 inv 5.

## Why this matters

v0 transactions compress their account list via ALT indices. Without
expansion, the sheet shows raw indices (`acct[3] of table ABC`) which
is indistinguishable from a drain payload. Jupiter / Magic Eden /
Tensor all use ALTs heavily — the resolver is a Phase 1b prerequisite
for any meaningful simulation or decoding on mainnet.

## Scope

- `services/chains/solana/altResolver.ts`:
  - `resolveLookupTables(tx: CompiledTransactionMessage, rpc:
    SolanaRpc): Promise<ResolvedAccounts>` — fetches every ALT
    referenced in `tx.message.addressTableLookups`, reads its
    `addresses: PublicKey[]`, returns a flat list of writable +
    read-only accounts.
  - Uses `@solana-program/address-lookup-table` for account parsing.
  - Uses `@solana/kit` `getAccountInfo` via `solanaRpcPool` (Task 05)
    — read-only, cacheable for 2 s.
  - Returns `{ writable: Address[], readonly: Address[], resolved:
    boolean }`.
  - On missing / deactivated table: `resolved: false` + empty arrays;
    caller annotates `warn: "lookup table unreadable"` per invariant 5.
- `altResolver.test.ts`:
  - Jupiter's public ALT (hard-coded fixture PDA): resolves to > 50
    accounts including known System + Token program PDAs.
  - Missing ALT: returns `resolved: false` without throwing.
  - Deactivated ALT (deactivation slot in past): `resolved: false`.
- Used by `SolanaSimulationInspector` (Task 11) before it builds the
  `writableAccounts` list for `simulateTransaction.accounts`.

## Rules (non-negotiable)

- **Unresolved ALT never silently drops accounts.** The caller gets
  `resolved: false` and must annotate `warn` — do not pretend we saw
  an empty table.
- **Cache via `solanaRpcPool` read-only TTL.** ALT contents are
  effectively immutable once extended; 2 s is fine.
- **No direct `Connection` / `@solana/web3.js` import.** §4.4 lock:
  `@solana/kit` only.

## Acceptance

- [ ] Jupiter ALT fixture expansion count matches on-chain reality.
- [ ] Missing-table path returns `resolved: false`.
- [ ] `pnpm run test -- altResolver` green.

## Out of scope

- Consuming the resolver in simulation / sheet (Tasks 11, 16).
