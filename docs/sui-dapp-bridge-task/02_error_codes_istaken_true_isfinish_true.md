# Task 02 — `services/chains/sui/errorCodes.ts` + `assertSuiErrorCode`

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `sui-dapp-bridge-spec.md` §3.1 (errorCodes.ts row), §10.3 of the Solana adapter spec (analogue source).

## Why this matters

Wallet Standard error contracts must be stable: a dApp branches on the
RPC error code, not on the message string. Centralising the codes (and
the `assertSuiErrorCode` predicate the test suite uses) prevents drift
between the adapter, the inspectors, and the executeApproval branches.

## Scope

- Create `services/chains/sui/errorCodes.ts`:
  - Constants for every code the adapter can return — at minimum:
    `4001` (user rejected), `4100` (unauthorised — no grant for origin),
    `-32601` (method not found), `-32602` (invalid params),
    `-32603` (internal — including "no signer registered"),
    `-32000` (generic adapter error).
  - `assertSuiErrorCode(code: number)` predicate for use in tests.
  - `suiError(code, message, data?)` helper that builds the JSON-RPC
    error shape the bridge emits.
- Create `services/chains/sui/SuiAdapter.errorCodes.test.ts` — table-
  driven test asserting every constant is integer-typed and the helper
  produces the right wire shape.

## Rules (non-negotiable)

- **No new codes invented.** Reuse EIP-1193 / JSON-RPC 2.0 standard
  codes. Sui Wallet Standard does not define a chain-specific error set.
- **Cross-namespace trust rejection uses `4100`.** Per spec §11 — an
  origin with an EVM grant attempting `standard:connect({silent:true})`
  on Sui must get `4100`, not `4001` (different UX semantics).

## Acceptance

- [ ] All constants exported and typed `number`.
- [ ] `assertSuiErrorCode` rejects non-listed codes with a clear message.
- [ ] `pnpm check:syntax` passes; tests green.

## Out of scope

- Adapter use of these codes (Tasks 04, 06, 07).
