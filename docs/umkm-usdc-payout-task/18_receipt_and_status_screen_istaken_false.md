# Task 18 — Receipt screen + live `SETTLED → PAID_OUT` updates

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §2 step 9, §6.3, §11 M3

## Why this matters

After the <500 ms Nanopay attestation, the user waits seconds-to-minutes
for Xendit to credit the merchant's wallet/bank. The receipt screen has to
surface both states cleanly — *"Circle said PAID"* and *"Xendit said PAID"* —
and live-update when the FCM push fires.

## Scope

- Create `app/pay-merchant/receipt.tsx`:
  - Takes `intentId` as param.
  - Reads `usePaymentIntent(intentId)` (task 14).
  - Visual states:
    - `SIGNED` — skeleton shimmer: "Confirming with Circle…".
    - `SETTLED` — big green check + "Paid USDC · waiting for merchant
      settlement…". Keep polling (3 s) under the hood.
    - `PAID_OUT` — "Merchant received [local-fiat amount]" + Xendit channel
      icon + masked account (last-4 from `merchant.channel.accountNumberLast4`).
    - `FAILED` — `<PaymentError code={failureCode} />` (task 16) with
      Xendit-specific codes from §9.1.
    - `EXPIRED` — `<PaymentError code="INTENT_EXPIRED" />`.
  - Receipt body: amount (fiat + USDC), merchant name, intent id as
    copyable-but-clipped text, timestamp.
  - Primary CTA: "Done" → `router.dismissAll()`.
- Register an FCM message handler (reuse the app's existing FCM wiring)
  that on `type: "payment_intent_update"` calls `invalidatePayIntent(id)`
  from task 14. No bespoke state store — TanStack Query handles it.
- Push-banner in-app on receiving the FCM while the user is already on the
  receipt screen: silent update is fine (data changes on screen); only emit
  a user-facing banner if the user is on a different screen.
- Telemetry: `receipt_viewed`, `receipt_terminal_state` with `{ status }`.

## Rules (non-negotiable)

- **No SSE** (§6.3). Polling + FCM invalidation only.
- **Receipt never signs anything.** It's a read-only view.
- **No mock of PAID_OUT for UX-polish.** If the server says `SETTLED`, we
  render SETTLED — no fake-it-til-the-webhook-arrives.
- **Clipboard** follows `docs/clipboard-policy.md` — copying the intent id
  is fine; do not copy the JWS or signature.

## Acceptance

- [ ] Receipt renders correctly for each of the 5 states against
      hand-crafted TanStack Query fixtures.
- [ ] FCM invalidation: synthesised push → cache refetch → UI updates
      without remount.
- [ ] Manual smoke end-to-end: M2 flow + M3 backend stub produces
      `SETTLED → PAID_OUT` transition live on screen.
- [ ] `pnpm check:syntax` + `pnpm lint` pass.

## Out of scope

- A merchant-side "payouts history" screen (deferred v1.1 per §1.1.1).
- Refund-request flow (§12 Q5 deferred).
