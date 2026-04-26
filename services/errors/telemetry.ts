/**
 * `services/errors/telemetry.ts` — fire-and-forget telemetry for the
 * payer error surface. Invoked from `<PaymentError>` on mount so every
 * rendered error emits a funnel event.
 *
 * Spec: `docs/umkm-usdc-payout-spec.md` §9.1 — "every displayed error
 * emits a payment_error_shown event with { code, intentId?, merchantId? }".
 *
 * Rules:
 *   - **Best-effort only.** Never blocks the UI. All failures are
 *     swallowed; callers never await the result in a way that can
 *     surface a user-visible error.
 *   - **Sensitive-field hygiene.** Only the enumerated `PaymentErrorCode`
 *     and the optional `intentId` / `merchantId` (opaque server ids)
 *     are sent. Never include `err.message`, signatures, nonces, or
 *     raw typed-data.
 *   - **Endpoint may 404.** Backend counterpart is a follow-up; when
 *     the route isn't mounted yet a 404 (or any non-2xx / network
 *     failure) is swallowed silently.
 *   - Uses raw `fetch` instead of the shared ky `api` instance so the
 *     global ky error interceptor doesn't fire console.error / toasts
 *     on expected 404s.
 */

import type { PaymentErrorCode } from "./paymentErrors";

const TELEMETRY_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export interface LogPaymentErrorArgs {
  code: PaymentErrorCode;
  intentId?: string;
  merchantId?: string;
}

/**
 * POSTs `{ code, intentId?, merchantId? }` to
 * `${EXPO_PUBLIC_API_URL}/telemetry/payment-error`. Fire-and-forget:
 * resolves without error regardless of the transport outcome.
 */
export function logPaymentError(args: LogPaymentErrorArgs): void {
  void sendPaymentErrorEvent(args);
}

async function sendPaymentErrorEvent(args: LogPaymentErrorArgs): Promise<void> {
  try {
    const body: Record<string, string> = { code: args.code };
    if (args.intentId) body.intentId = args.intentId;
    if (args.merchantId) body.merchantId = args.merchantId;

    await fetch(`${TELEMETRY_BASE_URL}/telemetry/payment-error`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Swallow all failures — 404, network, timeout. This endpoint is
    // best-effort and may not exist during early milestones.
  }
}
