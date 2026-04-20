# Task 12 — `buildAuthorization()` — pure EIP-712 builder

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §5.5 (service module),
§6.2 (`NanopayPayload`), §11 M2

## Why this matters

Separating payload shaping from wallet signing keeps unit tests cheap (no
keystore) and makes the agent-mode extension (§8) a straight reuse.

## Scope

- Create `services/nanopay/buildAuthorization.ts`:
  ```ts
  export interface BuildAuthorizationInput {
    nanopay: NanopayPayload;     // from PaymentIntent
    wallet:  TWallet;            // supplies `from` sanity check
    chain:   ChainConfig;
  }
  export interface AuthorizationPayload {
    wallet: TWallet;
    chain:  ChainConfig;
    usdc:   `0x${string}`;
    from:   `0x${string}`;
    to:     `0x${string}`;
    valueMicros: bigint;
    validAfter:  number;
    validBefore: number;
    nonce:       `0x${string}`;
  }
  export const buildAuthorization = (i: BuildAuthorizationInput): AuthorizationPayload => { … };
  ```
- Validation (zod or handwritten, either fine):
  - `nanopay.from.toLowerCase() === wallet.addresses.eip155?.toLowerCase()`
    → else throw typed error `"FROM_ADDRESS_MISMATCH"` (paired with
    task 16's error matrix as a developer-only code — should never reach
    the UI).
  - `nanopay.sourceChainId === chain.chain.id`.
  - `nanopay.validBefore > nowSeconds()` and `validBefore - validAfter < 600`
    (reject intents with a too-wide window — §9 covers replay).
  - `valueMicros > 0n`.
- Zod schema for `NanopayPayload` lives here and is exported for task 13 to
  reuse.
- Unit tests: happy path, each validation-fail branch, `valueMicros` string
  → bigint coercion from server JSON.

## Rules (non-negotiable)

- **Pure, synchronous, no I/O.** Enforces that task 15 can call it inline.
- **No `viem` here.** Building the typed-data struct is `EvmWalletKit`'s
  job (task 11); this module only shapes arguments.
- **Zod at the boundary** — same convention as elsewhere in the codebase.
- **`bigint` for value.** Server sends `number` because JSON; this is where
  we coerce to `bigint` exactly once.

## Acceptance

- [ ] `buildAuthorization.ts` + `buildAuthorization.test.ts` exist with
      passing tests.
- [ ] Grep shows no `viem` / `react` imports.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Broadcasting / submitting the signed authorization (task 13).
- Screen wiring (task 15).
