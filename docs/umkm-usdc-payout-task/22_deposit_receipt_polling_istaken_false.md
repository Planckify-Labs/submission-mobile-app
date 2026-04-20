# Task 22 — `deposit-receipt` POST + attestation polling

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §6.2
(`DepositReceiptRequest/Response`), §5.2 step 1, §11 M4

## Why this matters

After the deposit tx is submitted (task 20), Circle emits a Gateway
attestation. The mobile app proves the deposit to `takumipay-api`, backend
waits for the attestation, and then the pending intent — if any — can
proceed to Nanopay.

## Scope

- Add to `services/nanopay/gatewayDeposit.ts`:
  ```ts
  export const submitDepositReceipt = async (i: DepositReceiptRequest): Promise<DepositReceiptResponse> => { … };
  ```
  Single authenticated POST, zod-validated response.
- Add a TanStack Query hook `useDepositStatus(depositId)`:
  - Polls `GET /v1/pay/deposits/:depositId` every 5 s while the status is
    `PENDING_ATTESTATION`.
  - Stops polling on terminal `CONFIRMED` / `FAILED`.
  - Terminal `CONFIRMED` should invalidate any pending `usePaymentIntent`
    so `/pay-merchant` re-renders without the `REQUIRES_DEPOSIT` gate.
- Wire into `app/onboarding/nanopay-deposit.tsx` (task 21):
  1. After `sendGatewayDeposit` returns `{ txHash, useCirclePaymaster }`,
     call `submitDepositReceipt({ txHash, chainId, useCirclePaymaster })`.
  2. Switch to the "Finalizing your setup…" view.
  3. `useDepositStatus` drives the transition to `CONFIRMED` (which
     navigates back to the caller) or `FAILED` (which surfaces
     `<PaymentError code="DEPOSIT_FAILED" />`).
- Persist the `depositId` on app storage so a force-quit during
  `PENDING_ATTESTATION` can resume on next launch — no money at risk, but a
  stuck onboarding is user-hostile.

## Rules (non-negotiable)

- **Backend is the source of truth** for attestation status. Mobile does
  not read Circle attestations directly.
- **Resumable.** Don't lose the `depositId` on process kill.
- **Default TanStack Query policy** with the narrower 5 s
  `refetchInterval` while pending.
- **No SSE** (§6.3).

## Acceptance

- [ ] Fresh deposit → polling → `CONFIRMED` → pending intent becomes
      payable end-to-end on staging.
- [ ] Force-quit mid-`PENDING_ATTESTATION` → next launch resumes polling,
      resolves correctly.
- [ ] `FAILED` path renders the right `<PaymentError>`.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Backend attestation webhook handling (`takumipay-api`).
- Displaying the Gateway unified-balance on Home — post-v1 polish.
