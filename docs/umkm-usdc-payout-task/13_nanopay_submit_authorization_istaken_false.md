# Task 13 — `submitAuthorization()` — proxy POST + attestation

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §5.5, §6.2
(`NanopaySubmitRequest` / `NanopaySubmitResponse`), §6.5, §9.1 (error codes)

## Why this matters

Posts the signed EIP-3009 authorization to `takumipay-api /v1/pay/intents/:id/nanopay`
and normalizes the response into one of a small set of failure codes the UI
knows how to render. Decision is **locked**: mobile always goes via proxy —
never directly to Circle (§6.5).

## Scope

- Create `services/nanopay/submitAuthorization.ts`:
  ```ts
  export interface SubmitInput {
    intentId: `pi_${string}`;
    signature: `0x${string}`;
    payload:   NanopayPayload;
  }
  export const submitAuthorization = async (i: SubmitInput): Promise<NanopaySubmitResponse> => { … };
  ```
- Uses the existing authenticated `apiClient` (SIWE bearer), same auth
  wrapper the rest of `hooks/queries/*` uses.
- Parses the response with the `NanopaySubmitResponse` zod schema from §6.2.
- Returns the parsed object verbatim — do not remap fields. Callers read
  `result.status === "SETTLED"` directly.
- Retries: the `EXPO_PUBLIC_CIRCLE_NANOPAY_SUBMIT_VIA_SERVER` flag stays
  `true` in v1; no client-side retry loop in this function. Caller owns
  retry (task 15 handles the exp-backoff for `CIRCLE_UPSTREAM_ERROR`).
- Unit tests with `msw` or `nock` covering:
  - 200 `SETTLED` — returns parsed object.
  - 200 `FAILED` with each `NanopayFailureCode` — passes through.
  - 410 `QUOTE_EXPIRED` → treat as logical failure with
    `failure.code: "QUOTE_EXPIRED"`.
  - Network error → throw — retry is the caller's concern.

## Rules (non-negotiable)

- **Proxy only.** Never call `api.circle.com` directly from the mobile app
  (§6.5). If someone flips the env flag to `false` in dev, log a loud
  warning in development mode only.
- **Zod at the boundary.** Every response body parsed before return.
- **No business logic here.** No Xendit firing, no receipt writing, no
  navigation — just HTTP + shape.
- **Idempotency.** The `intentId` is the idempotency key end-to-end (§9).
  The server handles dedup; callers can re-POST on transport failure.

## Acceptance

- [ ] `submitAuthorization.ts` exists with passing tests.
- [ ] No direct `api.circle.com` string in the repo (grep).
- [ ] Zod schemas exported alongside for reuse (task 14 consumes
      `NanopaySubmitResponseSchema` for response polling too).
- [ ] `pnpm check:syntax` passes.

## Out of scope

- Polling (task 14).
- UI integration (task 15).
- Xendit webhook handling (backend task).
