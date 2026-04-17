# Task 21 — Error-code contract + Zod validation at adapter boundary

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `solana-adapter-spec.md` §10.3, §6 Phase 1b.

## Why this matters

Every `SolanaAdapter` error path must return exactly one of the 8
codes in §10.3. Today error paths return ad-hoc strings; dApps
parsing for EIP-1193 codes ignore us silently. Table-driven
compliance tests prevent regressions as Phase 1c lands more error
paths.

## Scope

- **Zod schemas** per wire input (from Task 02 payload union), mounted
  at `SolanaAdapter.handleRequest` entry:
  - `parse(req.params)` — on failure → `ChainResult.error(-32602)`
    with the Zod issue shape in `data`.
  - Validates cluster strings via `canonicalizeChain`, base64 tx
    non-empty, SIWS `domain` non-empty, `signAllTransactions` N ≤ 20.
- **Error-code map** — every existing and future error path must
  map to one of:
  - `4001` — user reject (sheet's Reject button).
  - `4100` — unauthorized (no grant, SIWS address mismatch, no
    active Solana wallet).
  - `4200` — unsupported method (unknown feature key, legacy
    `window.solana.signIn`).
  - `4900` — disconnected (active wallet deleted mid-flight).
  - `4901` — cluster not connected (§4.5 step 4).
  - `-32002` — resource unavailable (`DappBridge.enqueue` conflict;
    already emitted by bridge).
  - `-32602` — invalid params (base64 decode, version mismatch,
    CAIP-2 malformed, SIWS expirationTime ≤ issuedAt, N > 20).
  - `-32603` — internal (RPC failure, signer missing, ALT resolve
    fail, blockhash expiry).
- **Table-driven test** `SolanaAdapter.errorCodes.test.ts`:
  - For every row in §10.3, craft the minimal fixture and assert the
    exact code returned.
  - For every error-emitting branch in `handleRequest` +
    `executeApproval`, assert the code matches the table.
  - Fail CI on any new error path that returns a code outside this
    set.
- **Never leak raw exception text.** Invariant implicit in §10.3:
  `-32603` carries a safe summary; original exception stashed in
  `data.internalError` (never emitted on `BridgeEventBus` — Task 22
  redaction).

## Rules (non-negotiable)

- **No new codes invented.** If a new error case doesn't map, fix
  the case — don't grow the table.
- **Zod runs first, sheets second.** A malformed payload never
  reaches an inspector or a sheet.
- **Raw exceptions never returned.** Always normalised to the table.

## Acceptance

- [ ] Every row in §10.3 has at least one test.
- [ ] Table-driven test covers every error-emitting branch.
- [ ] Malformed base64 → `-32602`; malformed cluster → `-32602`;
      missing wallet → `4100`; unknown feature → `4200`.
- [ ] Raw exception message never appears in the response payload.

## Out of scope

- EVM error codes — out of scope, they're already defined.
