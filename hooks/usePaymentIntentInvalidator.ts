/**
 * `usePaymentIntentInvalidator` — returns a callback the push-notification
 * handler (task 32) can fire to force an immediate `useIntentStatus` refetch
 * when FCM/APNs delivers a `payout.paid_out` notification for an intent the
 * user is currently viewing.
 *
 * Spec: `docs/umkm-usdc-payout-spec.md` §6.3 (FCM/APNs), §2 step 9 (receipt).
 * Task 31 (receipt + status live) produces this helper; task 32 (push on
 * PAID_OUT) consumes it from the notification listener.
 *
 * Why this exists — the polling query in `useIntentStatus` refetches every
 * 3 s until terminal. When a push lands mid-poll we don't want to wait the
 * residual interval to show "paid_out"; invalidating the matching query
 * forces an immediate refetch and flips the UI within the push round-trip.
 *
 * Three-role separation (memory `feedback_role_separation.md`): this helper
 * only *invalidates* — it never mutates the cached intent optimistically.
 * The server remains the source of truth; we just ask the query engine to
 * re-read it sooner than the poll tick would.
 *
 * Never log the intentId — §9 clipboard/logging hygiene.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Returns `(intentId: string) => void`. Calling it invalidates every
 * cached `useIntentStatus(intentId, *)` observer regardless of which
 * wallet the query was bound to, prompting an immediate refetch.
 *
 * Why a hand-built prefix instead of `intentQueryKey(intentId)` —
 * the canonical key is `["pay-intent", intentId, walletAddress ?? null]`.
 * Building it without a wallet pins the third element to `null`, which
 * with TanStack's prefix matching only matches the wallet-less variant
 * and silently misses the wallet-scoped queries that the receipt screen
 * and `/pay-merchant` actually run. We pass the two-element prefix so
 * any third element (null *or* a wallet address) matches.
 */
export function usePaymentIntentInvalidator(): (intentId: string) => void {
  const queryClient = useQueryClient();
  return useCallback(
    (intentId: string) => {
      if (!intentId) return;
      queryClient.invalidateQueries({ queryKey: ["pay-intent", intentId] });
    },
    [queryClient],
  );
}
