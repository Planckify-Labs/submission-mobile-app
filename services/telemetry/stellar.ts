/**
 * Stellar telemetry wrapper — Sentry-shaped tag / breadcrumb / context API.
 *
 * Spec reference: `docs/stellar-chain-support-spec.md` §10 task 15.
 *
 * Mirrors `services/telemetry/sui.ts` — this codebase does not yet
 * initialise `@sentry/react-native`, so this module exposes the
 * Sentry-shaped surface as no-ops (with dev `console.info` mirroring).
 * When the project's Sentry SDK lands, this file gets the `Sentry.*`
 * swaps and every Stellar call site flows through automatically.
 *
 * Privacy invariants (mirrors `telemetry/sui.ts`):
 *   - NEVER pass seed bytes, mnemonic words, StrKey `S…` secrets, or raw
 *     signer references to any function in this module.
 *   - Public chain identifiers (tx hashes after success, asset codes,
 *     issuer addresses) are fine — they're on-chain data.
 */

type BreadcrumbLevel = "info" | "warning" | "error";

interface BreadcrumbInput {
  category: string;
  message?: string;
  level?: BreadcrumbLevel;
  data?: Record<string, unknown>;
}

interface ChainTagInput {
  chain: string;
  network?: string;
}

/**
 * TODO: wire to Sentry once initialized:
 *   Sentry.setTag("chain", input.chain);
 *   if (input.network) Sentry.setTag("network", input.network);
 */
export function setStellarChainTag(input: ChainTagInput): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.info(
      "[telemetry.stellar] setTag",
      "chain=",
      input.chain,
      "network=",
      input.network ?? "(none)",
    );
  }
}

/**
 * TODO: wire to Sentry once initialized:
 *   Sentry.addBreadcrumb({ category, message, level, data });
 */
export function breadcrumb(input: BreadcrumbInput): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.info(
      "[telemetry.stellar]",
      input.category,
      input.level ?? "info",
      input.message ?? "",
      input.data ?? {},
    );
  }
}

/**
 * TODO: wire to Sentry once initialized:
 *   if (context) Sentry.setContext(context.name, context.payload);
 *   Sentry.captureException(err);
 */
export function captureException(
  err: unknown,
  context?: { name: string; payload: Record<string, unknown> },
): void {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    const name = err instanceof Error ? err.name : typeof err;
    console.info(
      "[telemetry.stellar] captureException",
      name,
      context?.name ?? "(no-context)",
      context?.payload ?? {},
    );
  }
}
