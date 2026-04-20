# Task 25 — `PayExecutor` path selector

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §5.6 (Path Selector), §3
(architecture diagram — `PayExecutor` box), §11 M5

## Why this matters

By M5 we have three execution paths (A direct-on-Arc, B Nanopay, C x402)
and `/pay-merchant` was stitched together one milestone at a time. This
task pulls them into a single `PayExecutor` module so the screen reads as
"give me the intent, I'll settle it" — no `if path === ...` ladder in the
UI.

## Scope

- Create `services/payExecutor/index.ts`:
  ```ts
  export interface PayExecutorInput {
    intent: PaymentIntent;        // canonical backend shape
    wallet: TWallet;
    chain:  ChainConfig;
    kit:    WalletKitAdapter;
  }
  export interface PayExecutorResult {
    status:  "SETTLED" | "FAILED";
    attestation?: { id: string; receivedAt: number };
    failure?:     { code: PaymentErrorCode; message: string };
  }
  export const executePay = async (i: PayExecutorInput): Promise<PayExecutorResult> => { … };
  ```
- Dispatch per §5.6:
  - `intent.gasless.requiresDeposit` → throw a typed `REQUIRES_DEPOSIT`
    error — the screen catches and routes to the onboarding. (Executor
    must never silently navigate.)
  - `intent.path === "nanopay"` → Path B (tasks 12/13).
  - `intent.path === "x402"` → Path C (task 23).
  - `intent.path === "direct_arc"` → Path A (task 24).
  - Default → typed error `"UNKNOWN_PATH"` (developer error; should never
    surface to user).
- Refactor `app/pay-merchant.tsx` to call `executePay(input)` on Pay.
  Remove the direct calls to `buildAuthorization` / `submitAuthorization` /
  `x402Client` / `sendTokenTransfer` — they all live behind the executor.
- Keep error-mapping **inside** the executor: every failure returns
  `{ status: "FAILED", failure: { code, message } }` where `code` is a
  value from `PaymentErrorCode` (task 16). The screen just renders
  `<PaymentError code={result.failure!.code} />`.
- Tests: one unit test per path with mocked adapters / fetchers, plus one
  `UNKNOWN_PATH` branch test.

## Rules (non-negotiable)

- **Executor is the only consumer of path strings.** Grep
  `"nanopay" | "x402" | "direct_arc"` outside `services/payExecutor/*`,
  `services/nanopay/*`, and `api/types/*` returns zero.
- **No navigation inside the executor.** It returns; the screen navigates.
- **No direct signing inside the executor.** It composes adapter calls.
- **Three-role separation** still holds: server-decided path, wallet-
  executed signatures, user-approved fiat amount.
- **Error codes map 1:1** to task 16's enum. No free-form strings.

## Acceptance

- [ ] `services/payExecutor/` exists; `app/pay-merchant.tsx` is reduced to
      "input → executePay → result" + error render.
- [ ] Grep rule above passes.
- [ ] All three paths unit-tested.
- [ ] M5 exit: scanning an x402 QR, a TakumiPay JWS, and a topped-up Arc
      wallet each produce the right end-state against staging.
- [ ] `pnpm check:syntax` + `pnpm lint` pass.

## Out of scope

- Agent-mode executor entry (§8 deferred post-v1).
- Refund flow (§12 Q5 deferred).
