# Task 21 — `/onboarding/nanopay-deposit` screen

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §5.2 (setup step 1), §5.4
(gasless table), §9.1 (`REQUIRES_DEPOSIT`, `PAYMASTER_UNAVAILABLE`,
`DEPOSIT_FAILED`), §11 M4

## Why this matters

Once-in-a-lifetime screen per user. After this, every scan-to-pay is
gasless forever. The UX has to make clear: *"this is the last time you'll
see this screen."*

## Scope

- Create `app/onboarding/nanopay-deposit.tsx`:
  - Header copy: "One-time setup: deposit USDC into Circle Gateway so every
    future payment is instant and free."
  - Input: amount in USDC (default to a sensible preset like 10 USDC;
    allow edit). Show local-fiat equivalent using the same FX quote hook
    the pay screen uses (null-safe — this screen works without a pending
    intent too).
  - Detected source chain from `activeChain` + kit presence:
    - If `kit.sendUserOpWithUsdcPaymaster` is available on this chain →
      "Fees paid in USDC (10% surcharge from Circle Paymaster)." — shows
      the USDC fee line.
    - Else → "Network fee paid in [native symbol]." — standard gas UX.
  - On Deposit:
    1. PIN/biometric gate.
    2. `sendGatewayDeposit(input, kit)` (task 20).
    3. On returned tx hash → navigate to a thin "Finalizing your setup…"
       state (`DEPOSIT_PENDING_ATTESTATION` row from §9.1).
    4. Task 22 polls; on `CONFIRMED` → pop back to `/pay-merchant` with
       the stored intent id (or to Home if there's no pending intent).
  - Errors (via `<PaymentError>`):
    - `PAYMASTER_UNAVAILABLE` — falls back to plain gas with the
      "Continue with network fee" CTA, which resubmits with
      `useCirclePaymaster: false`.
    - `DEPOSIT_FAILED` — Retry CTA.
    - `CHAIN_RPC_UNREACHABLE` — Retry.
- Entry points:
  - Deep-linked from `/pay-merchant` when `intent.gasless.requiresDeposit`.
  - Shown proactively during **new-user onboarding** (optional — wire a
    dismissable prompt on Home the first time the user sees a Scan pill).
- Zod-validate the deposit input (amount > 0, ≤ a sane ceiling like
  1 000 USDC for v1 sanity).

## Rules (non-negotiable)

- **One-way door.** Do not offer to "skip" and proceed to pay — the next
  screen's `REQUIRES_DEPOSIT` handling already provides the "Maybe later"
  behavior.
- **No `viem` imports in the screen.**
- **Presence-gated Paymaster branch.** `if (kit.sendUserOpWithUsdcPaymaster)`
  — never `if (chain.id === 8453 || chain.id === 42161)` (chain list
  changes; presence gating is forward-compatible).
- **Do not save the deposit amount to analytics in cleartext**; log only
  a bucket (`"<5" | "5-25" | "25-100" | ">100"`).

## Acceptance

- [ ] Screen renders correctly on a Base Sepolia wallet (paymaster path)
      and on an Arc Testnet wallet (plain-gas path).
- [ ] Error paths render their `<PaymentError>` rows.
- [ ] Back-navigation after failure returns to whatever screen called the
      onboarding (`/pay-merchant` or Home), not stuck in the flow.
- [ ] `pnpm check:syntax` + `pnpm lint` pass.

## Out of scope

- Backend `deposit-receipt` polling (task 22).
- Attested balance display on Home (post-M4 polish).
