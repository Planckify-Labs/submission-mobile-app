/**
 * Pure decision logic for `RebalancePreviewCard`'s terminal state.
 *
 * Extracted from the component so it can be unit-tested without a React
 * Native runtime (the repo ships no component test runner — same
 * posture as `PreviewCard.test.ts`).
 *
 * The bug this guards against: after the user approves, the dispatcher
 * overwrites the tool part's `output` with the executor's `ToolResult`
 * ({ status, error, tx_hash }) — which carries no `user_decision`. The
 * old card inferred "declined" from the absence of
 * `user_decision === "approved"`, so every executed rebalance (success
 * OR failure) rendered as "You declined this rebalance". Decide from
 * explicit signals instead.
 */

export type RebalanceCardSignals = {
  state?: string;
  error?: string;
  output?: { status?: string; user_decision?: string } | undefined;
};

export type RebalanceCardStatus = "declined" | "failed" | "executed";

/**
 * Resolve the terminal status, or `null` when the card is still live
 * (no decision/result yet) and should render its interactive form.
 */
export function resolveRebalanceCardStatus(
  signals: RebalanceCardSignals,
): RebalanceCardStatus | null {
  const { state, error, output } = signals;

  // Explicit user rejection — the ONLY thing that is "declined".
  if (output?.user_decision === "rejected" || error === "user_declined") {
    return "declined";
  }

  // Executed-and-failed: the executor returned an error result (which is
  // NOT a user decline, handled above).
  if (state === "output-error" || output?.status === "failed") {
    return "failed";
  }

  // Executed-and-succeeded.
  if (
    state === "output-available" ||
    output?.status === "success" ||
    output?.user_decision === "approved"
  ) {
    return "executed";
  }

  // No terminal signal yet — still interactive.
  return null;
}
