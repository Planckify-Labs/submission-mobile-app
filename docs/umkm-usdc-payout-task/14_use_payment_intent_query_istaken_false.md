# Task 14 — `usePaymentIntent` TanStack Query hook

**Status:** Not taken
**Owner:** Mobile (mobile-app)
**Spec reference:** `umkm-usdc-payout-spec.md` §6.2, §6.3, §11 M2

## Why this matters

One hook owns intent status across the pay flow: create → sign → SETTLED →
PAID_OUT. TanStack Query keeps the cache coherent across the pay screen,
the receipt screen, and any in-session FCM-driven invalidation.

## Scope

- Create `services/nanopay/usePaymentIntent.ts` exposing:
  ```ts
  export const usePaymentIntent = (intentId: `pi_${string}` | null) => {
    return useQuery({ … });
  };
  export const useCreateIntent = () => useMutation({ … });          // POST /v1/pay/intents
  export const useSubmitNanopay = () => useMutation({ … });         // wraps submitAuthorization
  ```
- `usePaymentIntent` polls `GET /v1/pay/intents/:id` with a staleTime of
  `3s` (§6.3). Refetch interval: disabled by default; enable only when
  status is one of `"SIGNED" | "SETTLED"` (i.e. we're waiting on Xendit).
  Interval of `3s`, stop once the status is terminal (`PAID_OUT` / `FAILED`
  / `EXPIRED`).
- Query key: `["payIntent", intentId]`. `useCreateIntent` writes to the
  cache on success so `usePaymentIntent` is warm before the first poll.
- Zod-validate both the `PaymentIntent` and the `NanopaySubmitResponse`
  shapes from §6.2.
- Expose `invalidatePayIntent(intentId)` helper for FCM handlers to call.
- Unit tests: cache-warming from `useCreateIntent`, polling stops on
  terminal status, invalidation handler wipes + refetches.

## Rules (non-negotiable)

- **Default TanStack Query policy** from the project: `staleTime: 60_000`,
  `retry: 1`, `refetchOnWindowFocus: false` — override only `refetchInterval`
  and the narrower `staleTime: 3_000` for this specific hook. Document why
  inline.
- **No SSE in v1** (§6.3). Polling is cheap because Nanopay attestation
  lands <500 ms.
- **Use `useRQGlobalState`** only if we need to mirror intent state
  globally (we don't — the hook is sufficient). Memory
  `feedback_filter_at_source.md` still applies: do not post-filter results
  in consumers.
- **Skill reference:** `tanstack-query-patterns`, `avoid-useeffect` — hook
  consumers should not wrap this in a `useEffect`.

## Acceptance

- [ ] `usePaymentIntent.ts` exposes all three hooks + the invalidation
      helper.
- [ ] Tests cover polling start/stop, cache warming, invalidation.
- [ ] `pnpm check:syntax` passes.

## Out of scope

- FCM wiring (task 18).
- UI (task 15).
